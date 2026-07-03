"""JANSETU - Constituency Management Platform API."""
import os
import io
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Literal, Optional

from pydantic import BaseModel

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from models import (
    CitizenOTPRequest, CitizenOTPVerify, StaffLogin, ChangePassword,
    CitizenRegister, StaffCreate, User,
    Constituency, Area, AreaCreate, Household,
    Issue, IssueCreate, IssueAssign, IssueUpdateStatus, IssueFeedback,
    Visit, VisitCreate, Notification, NotificationCreate,
    DevWork, DevWorkCreate,
    Relationship, RelationshipCreate, RELATION_TYPES, inverse_relation,
    PortalConfig, PortalConfigCreate,
    ServiceInteraction, ServiceInteractionCreate,
    TransferInitiate, TransferVerify, CitizenMobileCheck,
    Caste, Religion, TaxonomyCreate,
    FamilyInvitation, FamilyLinkRequest,
    Karyakarta, PendingKaryakarta, KaryakartaCreate,
    ISSUE_CATEGORIES, ISSUE_STATUSES, DEV_STATUSES, VISIT_STATUSES,
    now_iso, new_id,
)
from storage_util import put_object, get_object, init_storage, APP_NAME
import v2_dualwrite as v2dw
import v2_transfer as v2tr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("jansetu")

app = FastAPI(title="JANSETU API")
api = APIRouter(prefix="/api")


# ----------------- Auth helpers -----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str, tenant_id: Optional[str] = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "tid": tenant_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def get_current_user_flexible(
    authorization: Optional[str] = Header(None),
    t: Optional[str] = Query(None),
) -> dict:
    """Like get_current_user but also accepts ?t=<token> for <img> tags / file downloads
    which cannot set custom headers."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    elif t:
        token = t
    if not token:
        raise HTTPException(401, "Missing token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_roles(*roles):
    async def _dep(user: dict = Depends(get_current_user)):
        # super_admin is treated as a superset of admin for backward compatibility.
        # Phase 3 will tighten admin-only portal endpoints to require super_admin explicitly.
        if user["role"] not in roles and not (user["role"] == "super_admin" and "admin" in roles):
            raise HTTPException(403, "Forbidden")
        return user
    return _dep


STAFF_ROLES = ("worker", "pa", "politician", "admin", "super_admin")


def is_staff(user: dict) -> bool:
    return user.get("role") in STAFF_ROLES


# ----------------- Multi-tenant helpers -----------------
def get_tenant_id(user: dict) -> Optional[str]:
    """Return the tenant_id the user belongs to. None means platform super_admin."""
    return user.get("tenant_id")


def tenant_filter(user: dict, extra_q: Optional[dict] = None) -> dict:
    """Compose a Mongo query that scopes to the user's tenant.

    Behavior:
      - super_admin: no tenant scoping applied (sees all tenants).
      - any other role: query is filtered to user.tenant_id.
      - user with no tenant_id (and not super_admin): 403.
    """
    q = dict(extra_q or {})
    if user.get("role") == "super_admin":
        return q  # platform-wide access (rule 2)
    tid = user.get("tenant_id")
    if not tid:
        raise HTTPException(403, "User has no tenant")
    q["tenant_id"] = tid
    return q


def get_tenant_id_for_write(user: dict) -> str:
    """Return the tenant_id to auto-attach on a write operation. Rule 3:
    frontend never sends tenant_id; backend derives it from the auth session.
    Super_admin cannot create tenant-scoped records (rule 2 keeps them as platform-only).
    """
    if user.get("role") == "super_admin":
        raise HTTPException(400, "Super admin cannot create tenant-scoped records; use a tenant admin account")
    tid = user.get("tenant_id")
    if not tid:
        raise HTTPException(403, "User has no tenant")
    return tid


async def can_access_file(user: dict, path: str) -> bool:
    """Permission check for /api/files/{path}.

    - Super_admin: all files (platform-wide access).
    - Staff (pa/politician/admin) of the tenant that owns the file: all files in their tenant.
    - Citizen: own profile photo, photos on their own issues, photos on approved (public) dev works.
    - Worker: additionally, photos on issues assigned to them.
    Files are tenant-bounded — a user from tenant A cannot access tenant B files.
    """
    role = user.get("role")
    if role == "super_admin":
        return True
    # Look up the file record to get its tenant_id; deny cross-tenant access.
    file_rec = await db.files.find_one({"storage_path": path}, {"tenant_id": 1, "uploaded_by": 1})
    file_tid = file_rec.get("tenant_id") if file_rec else None
    user_tid = user.get("tenant_id")
    if file_tid and user_tid and file_tid != user_tid:
        return False
    if role in ("pa", "politician", "admin"):
        return True
    # Own profile photo (any role)
    if await db.users.find_one({"id": user["id"], "profile_photo": path}, {"id": 1}):
        return True
    # Approved dev work photos are public to all logged-in users in the same tenant
    if await db.devworks.find_one(tenant_filter(user, {"photos": path, "approved": True}), {"id": 1}):
        return True
    # Issue photos — owning citizen or assigned worker (within same tenant)
    issue = await db.issues.find_one(
        tenant_filter(user, {"$or": [{"photos": path}, {"completion_photos": path}]}),
        {"citizen_id": 1, "assigned_to": 1},
    )
    if issue:
        if user["id"] == issue.get("citizen_id"):
            return True
        if role == "worker" and user["id"] == issue.get("assigned_to"):
            return True
    return False


# ----------------- Code generation -----------------
async def next_seq(name: str, tenant_id: Optional[str] = None) -> int:
    """Atomic counter. If tenant_id is provided, the counter is scoped per-tenant
    (each tenant restarts ISS/H sequences from 1). Without tenant_id, behaves
    legacy / global.
    """
    counter_id = f"{tenant_id}:{name}" if tenant_id else name
    res = await db.counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return res["seq"]


# ----------------- Startup -----------------
@app.on_event("startup")
async def on_start():
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init deferred: {e}")
    # seed if empty
    if await db.users.count_documents({"role": "admin"}) == 0:
        await seed_demo_data()
    # Backfill: ensure at least one default portal exists for already-seeded environments
    if await db.portal_configs.count_documents({}) == 0:
        await _ensure_default_portal()
        await _approve_demo_content()
    # Multi-tenant foundation migration (idempotent)
    await _migrate_to_multi_tenant()
    # Counter sync runs every startup (idempotent, only raises counters):
    await _sync_tenant_counters()
    # V2 indexes (M1, additive, idempotent — see migrations/__init__.py)
    await _ensure_v2_indexes()


async def _ensure_v2_indexes():
    """M1 — Create indexes for V2 collections. Idempotent. Does not write data.

    These indexes are needed before M2 backfill can run efficiently. They are
    additive and have no effect on V1 behaviour (empty collections in v1)."""
    from pymongo import ASCENDING, DESCENDING
    try:
        # persons: lookup by status, by merge chain
        await db.persons.create_index([("status", ASCENDING)])
        await db.persons.create_index([("merged_into_person_id", ASCENDING)],
                                      sparse=True)

        # credentials: unique (type, value) among active rows only
        await db.credentials.create_index(
            [("type", ASCENDING), ("value", ASCENDING)],
            unique=True,
            partialFilterExpression={"status": "active"},
            name="cred_type_value_active_unique",
        )
        await db.credentials.create_index([("person_id", ASCENDING)])

        # memberships: most queries by (person, status) or (org, status)
        await db.memberships.create_index(
            [("person_id", ASCENDING), ("status", ASCENDING)])
        await db.memberships.create_index(
            [("organisation_id", ASCENDING), ("status", ASCENDING)])
        await db.memberships.create_index(
            [("person_id", ASCENDING), ("organisation_id", ASCENDING)])
        await db.memberships.create_index([("household_id", ASCENDING)],
                                          sparse=True)

        # relationships: directed family edges (global; no tenant_id)
        await db.relationships_v2.create_index([("from_person_id", ASCENDING)])
        await db.relationships_v2.create_index([("to_person_id", ASCENDING)])

        # audit & consent
        await db.person_audit.create_index(
            [("person_id", ASCENDING), ("at", DESCENDING)])
        await db.person_consents.create_index(
            [("person_id", ASCENDING), ("organisation_id", ASCENDING),
             ("scope", ASCENDING)],
            unique=True, name="consent_unique")
        await db.access_audit.create_index(
            [("person_id", ASCENDING), ("at", DESCENDING)])
        await db.access_audit.create_index(
            [("accessed_by_user_id", ASCENDING), ("at", DESCENDING)])

        # Political CRM (Sprint B but indexes safe to create now)
        await db.parties.create_index([("name", ASCENDING)])
        await db.position_definitions.create_index(
            [("party_id", ASCENDING), ("level", ASCENDING)])
        await db.party_memberships.create_index(
            [("person_id", ASCENDING), ("start_date", DESCENDING)])
        await db.elections.create_index(
            [("year", DESCENDING), ("type", ASCENDING)])
        await db.election_events.create_index(
            [("person_id", ASCENDING), ("election_id", ASCENDING)])
        await db.influence_signals.create_index(
            [("person_id", ASCENDING), ("recorded_at", DESCENDING)])

        # Amendment 1.1 — Person timeline + origin-membership index
        await db.person_timeline_events.create_index(
            [("person_id", ASCENDING), ("at", DESCENDING)])
        await db.person_timeline_events.create_index(
            [("organisation_id", ASCENDING), ("at", DESCENDING)],
            sparse=True)
        # Tenant-visibility gate on operational records
        await db.issues.create_index([("origin_membership_id", ASCENDING)], sparse=True)

        # Stamp the V2 schema version so we know indexes are in place.
        await db.system_meta.update_one(
            {"_id": "v2_schema"},
            {"$set": {"version": 2, "applied_at": now_iso()}},
            upsert=True,
        )
        logger.info("V2 indexes ensured (M1 + Amendment 1.1).")
    except Exception as e:
        logger.warning(f"V2 index creation deferred: {e}")


async def _migrate_to_multi_tenant():
    """One-time multi-tenant migration. Idempotent. Records version in system_meta.

    Steps:
      1. Identify the default tenant (existing portal_configs with is_default=true).
      2. Backfill tenant_id on every domain doc missing it.
      3. Promote admin@jansetu.in to role=super_admin, tenant_id=null.
      4. Ensure the default tenant has its own admin user (auto-provisioned with temp password).
      5. Migrate global counters to tenant-prefixed keys.
      6. Stamp version meta.
    """
    meta = await db.system_meta.find_one({"_id": "multi_tenant"})
    if meta and meta.get("version", 0) >= 1:
        return  # already migrated

    default_tenant = await db.portal_configs.find_one({"is_default": True, "is_active": True})
    if not default_tenant:
        # No portal yet — nothing to migrate. The startup hook above seeds one
        # before this runs, so this branch is defensive only.
        logger.warning("Multi-tenant migration: no default portal — skipping")
        return
    default_tid = default_tenant["id"]

    # Step 2: Backfill tenant_id on every domain collection
    domain_collections = [
        "users", "households", "issues", "visits", "notifications",
        "devworks", "relationships", "interactions", "constituencies", "areas",
    ]
    backfill_counts = {}
    for coll in domain_collections:
        res = await db[coll].update_many(
            {"tenant_id": {"$exists": False}},
            {"$set": {"tenant_id": default_tid}},
        )
        backfill_counts[coll] = res.modified_count

    # Step 2b: Backfill new lifecycle fields on portal_configs for existing portals.
    await db.portal_configs.update_many(
        {"subscription_plan": {"$exists": False}},
        {"$set": {
            "subscription_plan": "trial",
            "is_trial": True,
            "portal_status": "active",
            "max_staff_limit": 25,
            "timezone": "Asia/Kolkata",
            "language": "en",
            "whatsapp_config": {},
            "sms_config": {},
        }},
    )

    # Step 3: Promote platform super-admin (admin@jansetu.in)
    await db.users.update_one(
        {"email": "admin@jansetu.in"},
        {"$set": {"role": "super_admin", "tenant_id": None}},
    )

    # Step 4: Ensure the default tenant has its own dedicated admin user
    tenant_admin_email = f"admin@{default_tenant['slug']}.jansetu.in"
    existing_tenant_admin = await db.users.find_one(
        {"email": tenant_admin_email, "tenant_id": default_tid}
    )
    temp_password_for_log = None
    if not existing_tenant_admin:
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits
        temp_password = "".join(secrets.choice(alphabet) for _ in range(12))
        temp_password_for_log = temp_password
        admin_user = User(
            role="admin",
            tenant_id=default_tid,
            name=f"Admin - {default_tenant['constituency_name']}",
            email=tenant_admin_email,
            password_hash=hash_password(temp_password),
        )
        await db.users.insert_one(admin_user.model_dump())
        await db.portal_configs.update_one(
            {"id": default_tid},
            {"$set": {
                "primary_admin_email": tenant_admin_email,
                "primary_admin_user_id": admin_user.id,
                "updated_at": now_iso(),
            }},
        )

    # Step 5: Migrate counters that don't have a tenant prefix
    # Counter docs with _id like "issue", "household" (no colon) get re-keyed to "{tid}:issue".
    async for counter in db.counters.find({"_id": {"$not": {"$regex": ":"}}}):
        old_id = counter["_id"]
        new_id = f"{default_tid}:{old_id}"
        # Only migrate if new key doesn't already exist
        if not await db.counters.find_one({"_id": new_id}):
            await db.counters.insert_one({"_id": new_id, "seq": counter.get("seq", 0)})
        await db.counters.delete_one({"_id": old_id})

    # Step 5b: Per-tenant counter sync — ensure each tenant's counter is at
    # least max(existing_code) so newly generated codes don't collide with
    # pre-seeded records.
    await _sync_tenant_counters()

    # Step 6: Stamp version
    await db.system_meta.update_one(
        {"_id": "multi_tenant"},
        {"$set": {"version": 1, "migrated_at": now_iso(), "default_tenant_id": default_tid}},
        upsert=True,
    )

    logger.info(f"Multi-tenant migration complete. Backfilled: {backfill_counts}")
    if temp_password_for_log:
        logger.info("=" * 80)
        logger.info("[ONE-TIME] Default tenant admin created:")
        logger.info(f"  Email:    {tenant_admin_email}")
        logger.info(f"  Password: {temp_password_for_log}")
        logger.info(f"  Tenant:   {default_tenant['constituency_name']} ({default_tenant['slug']})")
        logger.info("=" * 80)


async def _ensure_default_portal():
    """Create a single default portal config linked to the first constituency if none exists."""
    constituency = await db.constituencies.find_one({}, {"_id": 0})
    politician = await db.users.find_one({"role": "politician"}, {"_id": 0, "password_hash": 0})
    name = (politician or {}).get("name") or "Hon. Politician"
    designation = (politician or {}).get("designation") or "MLA"
    cname = (constituency or {}).get("name") or "Constituency"
    portal = PortalConfig(
        slug=_normalize_slug(cname) or "default",
        is_active=True,
        is_default=True,
        politician_name=name,
        designation=designation,
        constituency_name=cname,
        constituency_id=(constituency or {}).get("id"),
        welcome_message=f"Welcome to {cname}. Together, we build a stronger constituency.",
        tagline="Sewa. Suvidha. Sashaktikaran.",
        theme_color="#0A1128",
        contact_phone=None,
        contact_email=None,
        contact_address=None,
        office_hours="Mon - Sat, 10:00 AM to 6:00 PM",
        social_links={},
    )
    await db.portal_configs.insert_one(portal.model_dump())
    logger.info(f"Backfilled default portal: {portal.slug}")


async def _approve_demo_content():
    """One-time backfill: approve seeded devworks and visits so the demo portal is populated."""
    r1 = await db.devworks.update_many({"approved": {"$ne": True}}, {"$set": {"approved": True, "approved_at": now_iso()}})
    r2 = await db.visits.update_many({"status": "Pending Approval"}, {"$set": {"status": "Approved", "approved_at": now_iso()}})
    logger.info(f"Approved demo content: devworks={r1.modified_count}, visits={r2.modified_count}")


async def _sync_tenant_counters():
    """For each tenant, set counter['{tid}:issue'].seq = max(existing ISS code number)
    and same for household. This prevents code collisions when previously-seeded
    records exist before the counter sequence catches up.
    Idempotent — never lowers a counter, only raises it.
    """
    import re as _re
    code_pat = _re.compile(r"\d+")
    async for portal in db.portal_configs.find({}, {"id": 1}):
        tid = portal["id"]
        # Issues
        max_iss = 0
        async for doc in db.issues.find({"tenant_id": tid}, {"issue_code": 1}):
            m = code_pat.search(doc.get("issue_code", ""))
            if m:
                max_iss = max(max_iss, int(m.group()))
        if max_iss > 0:
            target = max_iss - 10000  # codes are "ISS-10001" → seq=1
            existing = await db.counters.find_one({"_id": f"{tid}:issue"}) or {"seq": 0}
            if target > existing.get("seq", 0):
                await db.counters.update_one({"_id": f"{tid}:issue"}, {"$set": {"seq": target}}, upsert=True)
        # Households
        max_hh = 0
        async for doc in db.households.find({"tenant_id": tid}, {"household_code": 1}):
            m = code_pat.search(doc.get("household_code", ""))
            if m:
                max_hh = max(max_hh, int(m.group()))
        if max_hh > 0:
            target = max_hh - 10000
            existing = await db.counters.find_one({"_id": f"{tid}:household"}) or {"seq": 0}
            if target > existing.get("seq", 0):
                await db.counters.update_one({"_id": f"{tid}:household"}, {"$set": {"seq": target}}, upsert=True)


# ----------------- Health -----------------
@api.get("/")
async def root():
    return {"name": "JANSETU API", "status": "ok"}


# ----------------- LEADS (public marketing form) -----------------
class LeadCreate(BaseModel):
    lead_type: Literal["demo", "trial", "sales"]
    name: str
    organisation: Optional[str] = None
    role: Optional[str] = None
    email: str
    mobile: str
    message: Optional[str] = None
    source_url: Optional[str] = None


@api.post("/leads")
async def create_lead(payload: LeadCreate):
    """Public endpoint used by the Landing hero + Final CTA (Book Demo /
    Request Free Trial / Contact Sales) forms. Persists the lead into
    `sales_leads` so the office can follow up. No auth required."""
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["status"] = "new"
    doc["created_at"] = now_iso()
    await db.sales_leads.insert_one(doc)
    return {"ok": True, "lead_id": doc["id"]}


@api.get("/admin/leads")
async def list_leads(user: dict = Depends(get_current_user)):
    """Super-admin view of all inbound sales leads."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    rows = await db.sales_leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return rows


@api.get("/meta/categories")
async def meta_cats():
    return {"issue_categories": ISSUE_CATEGORIES, "issue_statuses": ISSUE_STATUSES, "dev_statuses": DEV_STATUSES, "visit_statuses": VISIT_STATUSES}


async def _resolve_tenant_id(slug: Optional[str]) -> Optional[str]:
    """Resolve a portal slug to its tenant_id. Returns None if no slug provided."""
    if not slug:
        return None
    portal = await db.portal_configs.find_one({"slug": slug.strip().lower(), "is_active": True}, {"id": 1, "portal_status": 1})
    if not portal:
        raise HTTPException(404, "Portal not found")
    if portal.get("portal_status") == "suspended":
        raise HTTPException(403, "Portal is currently suspended")
    return portal["id"]


# ----------------- AUTH -----------------
@api.post("/auth/citizen/request-otp")
async def request_otp(payload: CitizenOTPRequest):
    await _resolve_tenant_id(payload.tenant_slug)  # validates slug if provided
    await db.otps.update_one(
        {"mobile": payload.mobile, "tenant_slug": payload.tenant_slug},
        {"$set": {"mobile": payload.mobile, "tenant_slug": payload.tenant_slug, "otp": "123456", "at": now_iso()}},
        upsert=True,
    )
    return {"sent": True, "demo_otp": "123456"}


@api.post("/auth/citizen/verify-otp")
async def verify_otp(payload: CitizenOTPVerify):
    if payload.otp != "123456" and len(payload.otp) != 6:
        raise HTTPException(400, "Invalid OTP")
    tid = await _resolve_tenant_id(payload.tenant_slug)
    q = {"mobile": payload.mobile, "role": "citizen"}
    if tid:
        q["tenant_id"] = tid
    # Skip transferred-out (is_active=False) rows so a citizen can't log into
    # a constituency they've been transferred away from.
    user = await db.users.find_one({**q, "is_active": {"$ne": False}},
                                   {"_id": 0, "password_hash": 0})
    if not user:
        # If they exist but were transferred away, surface that hint.
        archived = await db.users.find_one({**q, "is_active": False},
                                           {"_id": 0, "password_hash": 0})
        if archived:
            person_id = archived.get("person_id")
            new_user = None
            if person_id:
                new_user = await db.users.find_one(
                    {"role": "citizen", "person_id": person_id,
                     "is_active": True}, {"_id": 0, "password_hash": 0})
            cur_portal = await db.portal_configs.find_one(
                {"id": (new_user or {}).get("tenant_id")},
                {"_id": 0, "slug": 1, "politician_name": 1, "constituency_name": 1},
            ) if new_user else None
            return {"new_user": False, "transferred_out": True,
                    "current_portal": cur_portal,
                    "message": "You have been transferred to another constituency."}
        return {"new_user": True, "mobile": payload.mobile, "tenant_id": tid}
    token = create_token(user["id"], "citizen", user.get("tenant_id"))
    return {"token": token, "user": user, "new_user": False}


@api.post("/auth/citizen/check-mobile")
async def check_mobile(payload: CitizenMobileCheck):
    """Pre-registration helper. Tells the frontend whether the mobile already
    has a Person — and if so, whether they need to log in (same tenant) or
    transfer (different tenant). Used by CitizenRegister.jsx to drive the
    "Mobile already exists — transfer?" dialog.
    """
    tid = await _resolve_tenant_id(payload.tenant_slug)
    if not tid:
        raise HTTPException(400, "Invalid portal slug")
    return await v2tr.detect_transfer_need(
        db, mobile=payload.mobile.strip(),
        target_tenant_id=tid, target_tenant_slug=payload.tenant_slug,
    )


@api.post("/auth/citizen/transfer/initiate")
async def transfer_initiate(payload: TransferInitiate):
    """Step 1 of the transfer flow — emit the (mocked) OTP and persist a
    TransferRequest. Returns transfer_request_id + expiry.
    """
    try:
        result = await v2tr.initiate_transfer(
            db, mobile=payload.mobile.strip(),
            target_tenant_slug=payload.target_tenant_slug,
            reason=payload.reason,
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@api.post("/auth/citizen/transfer/verify")
async def transfer_verify(payload: TransferVerify):
    """Step 2 of the transfer flow — verify OTP and execute the transfer
    atomically (archive old membership, create new one, cross-link, etc.).
    Returns a fresh JWT for the citizen on the new tenant.
    """
    try:
        result = await v2tr.verify_and_execute_transfer(
            db, transfer_request_id=payload.transfer_request_id,
            otp=payload.otp, new_address=payload.new_address,
            next_seq_fn=next_seq, create_token_fn=create_token,
            now_iso_fn=now_iso,
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@api.get("/me/transfer-info")
async def me_transfer_info(user: dict = Depends(get_current_user)):
    """Returns transfer-related context for the logged-in citizen:
        - Whether their current membership was transferred from another org
        - The previous organisation's display info (if applicable)
        - The full membership history visible to the citizen's CURRENT tenant
          (their own Person id → all memberships of that Person — this is
          a citizen self-view so cross-tenant history is allowed).
    Used by the citizen UI to render the "Transferred from <Org>" banner.
    """
    pid = user.get("person_id")
    if not pid:
        return {"transferred_in": False, "history": []}
    current_mid = user.get("origin_membership_id")
    current_mem = await db.memberships.find_one({"id": current_mid}, {"_id": 0}) if current_mid else None
    transferred_in = False
    transferred_from = None
    if current_mem and current_mem.get("transferred_from_membership_id"):
        transferred_in = True
        from_mem = await db.memberships.find_one(
            {"id": current_mem["transferred_from_membership_id"]}, {"_id": 0})
        if from_mem:
            org = await db.portal_configs.find_one(
                {"id": from_mem["organisation_id"]},
                {"_id": 0, "id": 1, "slug": 1, "politician_name": 1,
                 "tenant_name": 1, "constituency_name": 1},
            )
            transferred_from = {
                "organisation": org,
                "archived_membership_id": from_mem["id"],
                "archived_at": from_mem.get("end_date"),
                "reason": from_mem.get("transfer_reason"),
            }
    history = await v2tr.get_person_membership_history(db, person_id=pid)
    return {
        "person_id": pid,
        "transferred_in": transferred_in,
        "transferred_from": transferred_from,
        "current_membership_id": current_mid,
        "history": history,
    }


@api.post("/auth/citizen/register")
async def citizen_register(payload: CitizenRegister):
    tid = await _resolve_tenant_id(getattr(payload, "tenant_slug", None))
    if not tid:
        raise HTTPException(400, "Portal context required for registration")
    # Per-tenant mobile uniqueness (rule 6)
    if await db.users.find_one({"mobile": payload.mobile, "role": "citizen",
                                "tenant_id": tid, "is_active": True}):
        raise HTTPException(400, "Mobile already registered in this constituency")
    # Cross-tenant detection: a mobile already linked to a Person in another
    # constituency must go through the explicit Transfer Workflow rather than
    # silently mint a second Person record.
    detection = await v2tr.detect_transfer_need(
        db, mobile=payload.mobile, target_tenant_id=tid,
        target_tenant_slug=getattr(payload, "tenant_slug", None) or "")
    if detection.get("exists") and not detection.get("same_tenant"):
        raise HTTPException(
            status_code=409,
            detail={"code": "TRANSFER_REQUIRED", **detection,
                    "message": "Mobile already registered in another constituency"})

    existing_hh = None
    if payload.house_number:
        hh_query = {"house_number": payload.house_number, "tenant_id": tid}
        if payload.ward_id:
            hh_query["ward_id"] = payload.ward_id
        if payload.village_id:
            hh_query["village_id"] = payload.village_id
        existing_hh = await db.households.find_one(hh_query)

    if existing_hh:
        await db.households.update_one({"id": existing_hh["id"]}, {"$inc": {"members_count": 1}})
        hh_id = existing_hh["id"]
    else:
        hh_seq = await next_seq("household", tid)
        hh_code = f"H-{10000 + hh_seq}"
        hh = Household(
            tenant_id=tid,
            household_code=hh_code,
            family_head_name=payload.family_head_name or payload.name,
            address=payload.address,
            house_number=payload.house_number,
            region_type=payload.region_type,
            ward_id=payload.ward_id,
            area_id=payload.area_id,
            village_id=payload.village_id,
            members_count=payload.members_count,
        )
        await db.households.insert_one(hh.model_dump())
        hh_id = hh.id

    user = User(
        role="citizen",
        tenant_id=tid,
        name=payload.name,
        mobile=payload.mobile,
        gender=payload.gender,
        dob=payload.dob,
        household_id=hh_id,
        region_type=payload.region_type,
        ward_id=payload.ward_id,
        area_id=payload.area_id,
        village_id=payload.village_id,
        house_number=payload.house_number,
        address=payload.address,
    )
    await db.users.insert_one(user.model_dump())
    # M3 dual-write — mirror this citizen into the V2 identity model.
    # Never raises; if V2 mirror fails the nightly parity check catches it.
    try:
        pid = await v2dw.ensure_person_for_user(db, user.model_dump())
        if pid:
            mem = await v2dw.resolve_active_membership(
                db, person_id=pid, organisation_id=tid)
            await db.users.update_one(
                {"id": user.id},
                {"$set": {"person_id": pid,
                          "origin_membership_id": mem["id"] if mem else None}},
            )
    except Exception:
        logger.exception("V2 dualwrite skipped for citizen registration")
    # ---- Pending Karyakarta promotion: attach role if we imported this mobile earlier ----
    try:
        pending_k = await db.pending_karyakartas.find_one(
            {"mobile": payload.mobile.strip(), "tenant_id": tid, "status": "pending"})
        if pending_k:
            pid_row = await db["_v2_user_to_person"].find_one({"_id": user.id})
            pid = pid_row.get("person_id") if pid_row else None
            k_doc = Karyakarta(
                tenant_id=tid, person_id=pid or "", user_id=user.id,
                name=pending_k["name"] or user.name, mobile=user.mobile,
                designation=pending_k.get("designation"),
                ward_id=pending_k.get("ward_id"), village_id=pending_k.get("village_id"),
                dob=pending_k.get("dob"), anniversary=pending_k.get("anniversary"),
                notes=pending_k.get("notes"),
            ).model_dump()
            await db.karyakartas.insert_one(k_doc)
            await db.users.update_one(
                {"id": user.id},
                {"$addToSet": {"extra_roles": "karyakarta"},
                 "$set": {"karyakarta_designation": pending_k.get("designation")}},
            )
            if pid:
                await db.persons.update_one(
                    {"id": pid}, {"$addToSet": {"types": "karyakarta"}})
            await db.pending_karyakartas.update_one(
                {"id": pending_k["id"]},
                {"$set": {"status": "linked", "linked_person_id": pid,
                          "resolved_at": now_iso()}},
            )
    except Exception:
        logger.exception("Pending karyakarta promotion failed")
    # ---- Pending Family Invitations: return them so the UI can prompt ----
    pending_invs: List[dict] = []
    try:
        pending_invs = await db.family_invitations.find(
            {"target_mobile": user.mobile, "tenant_id": tid, "status": "pending"},
            {"_id": 0},
        ).to_list(50)
    except Exception:
        pending_invs = []
    final_hh = await db.households.find_one({"id": hh_id}, {"_id": 0})
    token = create_token(user.id, "citizen", user.tenant_id)
    return {"token": token, "user": user.model_dump(exclude={"password_hash"}),
            "household": final_hh, "pending_family_invitations": pending_invs}


@api.post("/auth/staff/login")
async def staff_login(payload: StaffLogin):
    tid = await _resolve_tenant_id(payload.tenant_slug)
    q = {"email": payload.email.strip().lower(), "role": {"$ne": "citizen"}}
    if tid:
        q["tenant_id"] = tid
    user = await db.users.find_one(q)
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_token(user["id"], user["role"], user.get("tenant_id"))
    return {"token": token, "user": user}


@api.get("/me/timeline")
async def me_timeline(user: dict = Depends(get_current_user),
                      limit: int = 200):
    """Citizen Person-360 timeline (cross-tenant self-view)."""
    pid = user.get("person_id")
    if not pid:
        return {"person_id": None, "events": []}
    events = await db.person_timeline_events.find(
        {"person_id": pid}, {"_id": 0}
    ).sort("at", -1).to_list(max(1, min(limit, 500)))
    return {"person_id": pid, "events": events}


@api.get("/persons/{person_id}/timeline")
async def person_timeline(person_id: str,
                          user: dict = Depends(get_current_user),
                          limit: int = 200):
    """Staff view of a person's timeline, scoped to the staff's tenant.
    Returns only events emitted by the staff's organisation (operational
    tenant isolation enforced via organisation_id filter)."""
    target = await db.users.find_one(tenant_filter(user, {"id": person_id}), {"_id": 0, "person_id": 1})
    if not target:
        raise HTTPException(404, "Person not found")
    pid = target.get("person_id")
    if not pid:
        return {"person_id": None, "events": []}
    q = {"person_id": pid, "organisation_id": user.get("tenant_id")}
    events = await db.person_timeline_events.find(q, {"_id": 0}).sort("at", -1).to_list(max(1, min(limit, 500)))
    return {"person_id": pid, "events": events}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/change-password")
async def change_password(payload: ChangePassword, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not full or not verify_password(payload.current_password, full.get("password_hash", "")):
        raise HTTPException(400, "Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False}},
    )
    return {"ok": True}


@api.get("/tenant/setup")
async def get_setup_progress(user: dict = Depends(require_roles("admin"))):
    tid = get_tenant_id_for_write(user)
    portal = await db.portal_configs.find_one({"id": tid}, {"_id": 0})
    if not portal:
        raise HTTPException(404, "Portal not found")
    return {"setup_progress": portal.get("setup_progress", {}), "setup_completed": portal.get("setup_completed", False), "portal": portal}


@api.post("/tenant/setup/step")
async def update_setup_step(payload: dict, user: dict = Depends(require_roles("admin"))):
    tid = get_tenant_id_for_write(user)
    step = payload.get("step")
    done = bool(payload.get("done", True))
    if step not in ("branding", "constituency", "pa", "workers", "areas", "citizens"):
        raise HTTPException(400, "Invalid step")
    await db.portal_configs.update_one(
        {"id": tid},
        {"$set": {f"setup_progress.{step}": done, "updated_at": now_iso()}},
    )
    portal = await db.portal_configs.find_one({"id": tid}, {"_id": 0})
    # If all required steps done, mark setup_completed
    required = ["branding", "pa", "workers", "areas"]
    progress = portal.get("setup_progress", {})
    if all(progress.get(s) for s in required):
        await db.portal_configs.update_one({"id": tid}, {"$set": {"setup_completed": True}})
        portal["setup_completed"] = True
    return {"setup_progress": portal.get("setup_progress", {}), "setup_completed": portal.get("setup_completed", False)}


# ----------------- USERS / STAFF -----------------
@api.post("/admin/staff")
async def create_staff(payload: StaffCreate, user: dict = Depends(require_roles("admin"))):
    tid = get_tenant_id_for_write(user)
    email_norm = (payload.email or "").strip().lower()
    if not email_norm:
        raise HTTPException(400, "Email is required")
    # Block reuse of any platform-level (super_admin) email for tenant staff.
    platform_user = await db.users.find_one({"email": email_norm, "tenant_id": None})
    if platform_user:
        raise HTTPException(400, "This email is reserved for the platform and cannot be used for tenant staff")
    # Email uniqueness is per-tenant (rule 6 + clean multi-tenant semantics).
    if await db.users.find_one({"email": email_norm, "tenant_id": tid}):
        raise HTTPException(400, "Email exists in this tenant")
    u = User(
        role=payload.role,
        name=payload.name,
        tenant_id=tid,
        email=email_norm,
        password_hash=hash_password(payload.password),
        designation=payload.designation,
        mobile=payload.mobile,
    )
    await db.users.insert_one(u.model_dump())
    # M3 dual-write — mirror staff into V2 (Person + staff Membership). Then
    # stamp person_id / origin_membership_id back onto the V1 row for symmetry
    # with the citizen-register flow (testing_agent_v3 minor #1).
    try:
        pid = await v2dw.ensure_person_for_user(db, u.model_dump())
        if pid:
            mem = await v2dw.resolve_active_membership(
                db, person_id=pid, organisation_id=u.tenant_id)
            await db.users.update_one(
                {"id": u.id},
                {"$set": {"person_id": pid,
                          "origin_membership_id": mem["id"] if mem else None}},
            )
    except Exception:
        logger.exception("V2 dualwrite skipped for staff creation")
    out = await db.users.find_one({"id": u.id}, {"_id": 0, "password_hash": 0})
    return out or u.model_dump()


@api.get("/users")
async def list_users(role: Optional[str] = None, user: dict = Depends(get_current_user)):
    # Staff-only directory. Citizens never need a full user listing.
    if not is_staff(user):
        raise HTTPException(403, "Forbidden")
    q = tenant_filter(user)
    if role:
        q["role"] = role
    docs = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return docs


# ----------------- AREAS -----------------
@api.get("/constituencies")
async def list_constituencies(user: dict = Depends(get_current_user)):
    return await db.constituencies.find(tenant_filter(user), {"_id": 0}).to_list(100)


@api.get("/areas")
async def list_areas(kind: Optional[str] = None, region_type: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = tenant_filter(user)
    if kind:
        q["kind"] = kind
    if region_type:
        q["region_type"] = region_type
    return await db.areas.find(q, {"_id": 0}).sort("name", 1).to_list(2000)


@api.post("/areas")
async def create_area(payload: AreaCreate, user: dict = Depends(require_roles("admin"))):
    a = Area(**payload.model_dump(), tenant_id=get_tenant_id_for_write(user))
    await db.areas.insert_one(a.model_dump())
    return a.model_dump()


@api.delete("/areas/{area_id}")
async def delete_area(area_id: str, user: dict = Depends(require_roles("admin"))):
    await db.areas.delete_one(tenant_filter(user, {"id": area_id}))
    return {"ok": True}


# ----------------- HOUSEHOLDS -----------------
@api.get("/households")
async def list_households(search: Optional[str] = None, user: dict = Depends(get_current_user)):
    # Staff-only listing. Citizens look up their own via /households/{id} with their household_id.
    if not is_staff(user):
        raise HTTPException(403, "Forbidden")
    q = tenant_filter(user)
    if search:
        # also match member mobile/name (member lookup is also tenant-scoped)
        member_q = tenant_filter(user, {"$or": [{"mobile": {"$regex": search, "$options": "i"}}, {"name": {"$regex": search, "$options": "i"}}]})
        member_hh_ids = [u["household_id"] async for u in db.users.find(member_q, {"household_id": 1}) if u.get("household_id")]
        q["$or"] = [
            {"household_code": {"$regex": search, "$options": "i"}},
            {"family_head_name": {"$regex": search, "$options": "i"}},
            {"house_number": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}},
            {"id": {"$in": member_hh_ids}},
        ]
    return await db.households.find(q, {"_id": 0}).limit(200).to_list(200)


@api.post("/admin/reset-demo")
async def reset_demo(_: dict = Depends(require_roles("admin"))):
    """Wipe all non-admin data so the platform is ready for real onboarding."""
    await db.issues.delete_many({})
    await db.visits.delete_many({})
    await db.notifications.delete_many({})
    await db.devworks.delete_many({})
    await db.households.delete_many({})
    await db.users.delete_many({"role": "citizen"})
    await db.counters.delete_many({})
    return {"ok": True, "message": "Demo data cleared. Households, citizens, issues, visits, notifications and dev works removed."}


@api.get("/households/{hh_id}")
async def household_detail(hh_id: str, user: dict = Depends(get_current_user)):
    # Staff can view any household in their tenant; a citizen can only view their own household.
    if not is_staff(user) and user.get("household_id") != hh_id:
        raise HTTPException(403, "Forbidden")
    hh = await db.households.find_one(tenant_filter(user, {"id": hh_id}), {"_id": 0})
    if not hh:
        raise HTTPException(404, "Not found")
    members = await db.users.find(tenant_filter(user, {"household_id": hh_id}), {"_id": 0, "password_hash": 0}).to_list(100)
    issues = await db.issues.find(tenant_filter(user, {"household_id": hh_id}), {"_id": 0}).sort("created_at", -1).to_list(200)
    # Development benefits = approved dev works in same ward/village
    bq = tenant_filter(user, {"approved": True})
    or_clauses = []
    if hh.get("ward_id"):
        or_clauses.append({"ward_id": hh["ward_id"]})
    if hh.get("village_id"):
        or_clauses.append({"village_id": hh["village_id"]})
    if or_clauses:
        bq["$or"] = or_clauses
    benefits = await db.devworks.find(bq, {"_id": 0}).sort("created_at", -1).to_list(100) if or_clauses else []
    total = await db.issues.count_documents(tenant_filter(user, {"household_id": hh_id}))
    resolved = await db.issues.count_documents(tenant_filter(user, {"household_id": hh_id, "status": {"$in": ["Resolved", "Verified"]}}))
    pending = total - resolved
    return {"household": hh, "members": members, "issues": issues, "benefits": benefits, "stats": {"total": total, "resolved": resolved, "pending": pending}}


# ----------------- ISSUES -----------------
@api.post("/issues")
async def create_issue(payload: IssueCreate, user: dict = Depends(get_current_user)):
    tid = get_tenant_id_for_write(user)
    seq = await next_seq("issue", tid)
    code = f"ISS-{10000 + seq}"
    issue = Issue(
        tenant_id=tid,
        issue_code=code,
        citizen_id=user["id"],
        household_id=user.get("household_id"),
        category=payload.category,
        title=payload.title,
        description=payload.description,
        photos=payload.photos,
        gps_lat=payload.gps_lat,
        gps_lng=payload.gps_lng,
        location_address=payload.location_address,
        ward_id=user.get("ward_id"),
        village_id=user.get("village_id"),
        timeline=[{"status": "New", "at": now_iso(), "by": user["name"], "note": "Issue raised"}],
    )
    await db.issues.insert_one(issue.model_dump())
    # M3 dual-write — stamp person_id + origin_membership_id, emit timeline.
    try:
        await v2dw.sync_issue_to_v2(db, issue.model_dump(), citizen_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for issue creation")
    # Return latest stamped doc so the frontend gets the V2 fields too.
    return await db.issues.find_one({"id": issue.id}, {"_id": 0}) or issue.model_dump()


@api.get("/issues")
async def list_issues(
    mine: bool = False,
    status: Optional[str] = None,
    category: Optional[str] = None,
    ward_id: Optional[str] = None,
    village_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = tenant_filter(user)
    if mine or user["role"] == "citizen":
        q["citizen_id"] = user["id"]
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    if ward_id:
        q["ward_id"] = ward_id
    if village_id:
        q["village_id"] = village_id
    if assigned_to:
        q["assigned_to"] = assigned_to
    if user["role"] == "worker":
        q["assigned_to"] = user["id"]
    if search:
        q["$or"] = [
            {"issue_code": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    return await db.issues.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@api.get("/issues/{issue_id}")
async def issue_detail(issue_id: str, user: dict = Depends(get_current_user)):
    issue = await db.issues.find_one(tenant_filter(user, {"id": issue_id}), {"_id": 0})
    if not issue:
        raise HTTPException(404, "Not found")
    # Access policy within the tenant: staff (pa/politician/admin/super_admin) — all;
    # assigned worker — yes; owning citizen — yes; everyone else — 403.
    role = user.get("role")
    allowed = (
        role in ("pa", "politician", "admin", "super_admin")
        or (role == "worker" and user["id"] == issue.get("assigned_to"))
        or user["id"] == issue.get("citizen_id")
    )
    if not allowed:
        raise HTTPException(403, "Forbidden")
    citizen = await db.users.find_one(tenant_filter(user, {"id": issue["citizen_id"]}), {"_id": 0, "password_hash": 0})
    return {"issue": issue, "citizen": citizen}


@api.post("/issues/{issue_id}/assign")
async def assign_issue(issue_id: str, payload: IssueAssign, user: dict = Depends(require_roles("pa", "admin"))):
    worker = await db.users.find_one(tenant_filter(user, {"id": payload.assigned_to}), {"_id": 0})
    if not worker:
        raise HTTPException(404, "Worker not found")
    mobile_part = f" · Mobile: {worker.get('mobile')}" if worker.get("mobile") else ""
    update = {
        "assigned_to": payload.assigned_to,
        "assigned_to_name": worker["name"],
        "due_date": payload.due_date,
        "remarks": payload.remarks,
        "status": "Assigned",
        "updated_at": now_iso(),
    }
    res = await db.issues.update_one(
        tenant_filter(user, {"id": issue_id}),
        {
            "$set": update,
            "$push": {"timeline": {"status": "Assigned", "at": now_iso(), "by": user["name"], "note": f"Assigned to {worker['name']}{mobile_part}"}},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Issue not found")
    try:
        await v2dw.sync_issue_event(
            db, issue_id=issue_id, event_label="Assigned",
            note=f"Assigned to {worker['name']}", actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for issue assign")
    return await db.issues.find_one(tenant_filter(user, {"id": issue_id}), {"_id": 0})


@api.post("/issues/{issue_id}/status")
async def update_status(issue_id: str, payload: IssueUpdateStatus, user: dict = Depends(require_roles("worker", "pa", "admin"))):
    if payload.status not in ISSUE_STATUSES:
        raise HTTPException(400, "Invalid status")
    # workers can only update issues assigned to them
    if user["role"] == "worker":
        issue = await db.issues.find_one(tenant_filter(user, {"id": issue_id}))
        if not issue or issue.get("assigned_to") != user["id"]:
            raise HTTPException(403, "Not your assignment")
    update = {"status": payload.status, "updated_at": now_iso()}
    if payload.completion_notes:
        update["completion_notes"] = payload.completion_notes
    if payload.completion_photos:
        update["completion_photos"] = payload.completion_photos
    if payload.remarks:
        update["remarks"] = payload.remarks
    res = await db.issues.update_one(
        tenant_filter(user, {"id": issue_id}),
        {
            "$set": update,
            "$push": {"timeline": {"status": payload.status, "at": now_iso(), "by": user["name"], "note": payload.remarks or payload.completion_notes or ""}},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Issue not found")
    try:
        await v2dw.sync_issue_event(
            db, issue_id=issue_id, event_label=payload.status,
            note=payload.remarks or payload.completion_notes,
            actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for issue status update")
    return await db.issues.find_one(tenant_filter(user, {"id": issue_id}), {"_id": 0})


@api.post("/issues/{issue_id}/feedback")
async def feedback(issue_id: str, payload: IssueFeedback, user: dict = Depends(get_current_user)):
    issue = await db.issues.find_one(tenant_filter(user, {"id": issue_id}))
    if not issue or issue["citizen_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    # State guard: feedback may only be submitted when the issue has reached
    # "Resolved". Verifying earlier states (New / Assigned / In Progress) does
    # not make sense and was previously silently allowed.
    if issue.get("status") != "Resolved":
        raise HTTPException(400, "Feedback can only be submitted on Resolved issues")
    update = {
        "rating": payload.rating,
        "feedback_comment": payload.comment,
        "status": "Verified" if payload.verified else "Reopened",
        "updated_at": now_iso(),
    }
    note = f"Citizen rated {payload.rating}/5" + (f" — {payload.comment}" if payload.comment else "")
    await db.issues.update_one(
        tenant_filter(user, {"id": issue_id}),
        {
            "$set": update,
            "$push": {"timeline": {"status": update["status"], "at": now_iso(), "by": user["name"], "note": note}},
        },
    )
    try:
        await v2dw.sync_issue_event(
            db, issue_id=issue_id, event_label="Feedback",
            note=f"Rating {payload.rating}/5 — {payload.comment or ''}".strip(' —'),
            actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for issue feedback")
    return await db.issues.find_one(tenant_filter(user, {"id": issue_id}), {"_id": 0})


# ----------------- VISITS -----------------
@api.post("/visits")
async def create_visit(payload: VisitCreate, user: dict = Depends(require_roles("pa", "admin"))):
    tid = get_tenant_id_for_write(user)
    v = Visit(**payload.model_dump(), tenant_id=tid, created_by=user["id"])
    if user["role"] == "admin":
        v.status = "Published"
        v.approved_by = user["id"]
        v.approved_at = now_iso()
    else:
        v.status = "Pending Approval"
    await db.visits.insert_one(v.model_dump())
    # M3 dual-write
    try:
        await v2dw.sync_visit_to_v2(db, visit=v.model_dump(), actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for visit creation")
    if v.status == "Published" and v.visibility != "internal":
        await _publish_visit_notification(v, user)
    return await db.visits.find_one({"id": v.id}, {"_id": 0}) or v.model_dump()


async def _publish_visit_notification(v: Visit, user: dict):
    recipients = await _count_recipients(user, "wards" if v.ward_ids else ("villages" if v.village_ids else "all"), v.ward_ids, v.village_ids)
    notif = Notification(
        tenant_id=v.tenant_id,
        title=f"Visit: {v.title}",
        body=f"{v.visit_type} on {v.date} at {v.time} — {v.location}",
        notif_type="Politician Visit",
        scope="wards" if v.ward_ids else ("villages" if v.village_ids else "all"),
        ward_ids=v.ward_ids,
        village_ids=v.village_ids,
        created_by=user["id"],
        created_by_name=user["name"],
        recipients_count=recipients,
    )
    await db.notifications.insert_one(notif.model_dump())
    try:
        await v2dw.sync_notification_to_v2(
            db, notification=notif.model_dump(), actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for visit notification")


@api.post("/visits/{visit_id}/approve")
async def approve_visit(visit_id: str, user: dict = Depends(require_roles("politician", "admin"))):
    v = await db.visits.find_one(tenant_filter(user, {"id": visit_id}))
    if not v:
        raise HTTPException(404, "Not found")
    if v.get("status") == "Published":
        return {**{k: v[k] for k in v if k != "_id"}}
    await db.visits.update_one(tenant_filter(user, {"id": visit_id}), {"$set": {"status": "Published", "approved_by": user["id"], "approved_at": now_iso()}})
    visit = Visit(**{**v, "status": "Published", "approved_by": user["id"], "approved_at": now_iso()})
    if visit.visibility != "internal":
        await _publish_visit_notification(visit, user)
    try:
        await v2dw.sync_visit_approved(db, visit=visit.model_dump(), actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for visit approval")
    return await db.visits.find_one(tenant_filter(user, {"id": visit_id}), {"_id": 0})


@api.get("/visits")
async def list_visits(upcoming: bool = False, user: dict = Depends(get_current_user)):
    q = tenant_filter(user)
    if upcoming:
        q["date"] = {"$gte": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    if user["role"] == "citizen":
        q["status"] = "Published"
        # Internal-only visits are strictly hidden from citizens.
        q["visibility"] = {"$ne": "internal"}
    return await db.visits.find(q, {"_id": 0}).sort("date", 1).limit(200).to_list(200)


async def _count_recipients(user: dict, scope: str, ward_ids: list, village_ids: list) -> int:
    q = tenant_filter(user, {"role": "citizen"})
    if scope == "all":
        return await db.users.count_documents(q)
    or_clauses = []
    if ward_ids:
        or_clauses.append({"ward_id": {"$in": ward_ids}})
    if village_ids:
        or_clauses.append({"village_id": {"$in": village_ids}})
    if or_clauses:
        q["$or"] = or_clauses
    return await db.users.count_documents(q)


# ----------------- NOTIFICATIONS -----------------
@api.post("/notifications")
async def create_notif(payload: NotificationCreate, user: dict = Depends(require_roles("pa", "politician", "admin"))):
    tid = get_tenant_id_for_write(user)
    recipients = await _count_recipients(user, payload.scope, payload.ward_ids, payload.village_ids)
    n = Notification(**payload.model_dump(), tenant_id=tid, created_by=user["id"], created_by_name=user["name"], recipients_count=recipients)
    await db.notifications.insert_one(n.model_dump())
    try:
        await v2dw.sync_notification_to_v2(
            db, notification=n.model_dump(), actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for notification creation")
    return await db.notifications.find_one({"id": n.id}, {"_id": 0}) or n.model_dump()


@api.get("/notifications")
async def list_notifs(user: dict = Depends(get_current_user)):
    # filter for citizen by scope
    q = tenant_filter(user)
    if user["role"] == "citizen":
        clauses = [{"scope": "all"}]
        if user.get("ward_id"):
            clauses.append({"ward_ids": user["ward_id"]})
        if user.get("village_id"):
            clauses.append({"village_ids": user["village_id"]})
        q["$or"] = clauses
    return await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)


# ----------------- DEV WORKS -----------------
@api.post("/devworks")
async def create_dev(payload: DevWorkCreate, user: dict = Depends(require_roles("pa", "admin"))):
    tid = get_tenant_id_for_write(user)
    d = DevWork(**payload.model_dump(), tenant_id=tid, created_by=user["id"])
    if user["role"] == "admin":
        d.approved = True
        d.approved_by = user["id"]
        d.approved_at = now_iso()
    await db.devworks.insert_one(d.model_dump())
    try:
        await v2dw.sync_devwork_to_v2(db, devwork=d.model_dump(), actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for devwork creation")
    return await db.devworks.find_one({"id": d.id}, {"_id": 0}) or d.model_dump()


@api.post("/devworks/{dev_id}/approve")
async def approve_dev(dev_id: str, user: dict = Depends(require_roles("politician", "admin"))):
    res = await db.devworks.update_one(tenant_filter(user, {"id": dev_id}), {"$set": {"approved": True, "approved_by": user["id"], "approved_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.devworks.find_one(tenant_filter(user, {"id": dev_id}), {"_id": 0})


@api.delete("/devworks/{dev_id}")
async def delete_dev(dev_id: str, user: dict = Depends(require_roles("admin"))):
    await db.devworks.delete_one(tenant_filter(user, {"id": dev_id}))
    return {"ok": True}


@api.post("/devworks/{dev_id}/progress")
async def add_dev_progress(dev_id: str, note: str = Query(...), user: dict = Depends(require_roles("pa", "admin"))):
    entry = {"at": now_iso(), "by": user["name"], "note": note}
    res = await db.devworks.update_one(tenant_filter(user, {"id": dev_id}), {"$push": {"progress_updates": entry}, "$set": {"updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.devworks.find_one(tenant_filter(user, {"id": dev_id}), {"_id": 0})


@api.get("/devworks")
async def list_devs(status: Optional[str] = None, ward_id: Optional[str] = None, village_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = tenant_filter(user)
    if status:
        q["status"] = status
    if ward_id:
        q["ward_id"] = ward_id
    if village_id:
        q["village_id"] = village_id
    # citizens only see approved
    if user["role"] == "citizen":
        q["approved"] = True
    return await db.devworks.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)


@api.post("/devworks/{dev_id}/status")
async def update_dev(dev_id: str, status: str = Query(...), user: dict = Depends(require_roles("pa", "admin"))):
    if status not in DEV_STATUSES:
        raise HTTPException(400, "Invalid status")
    res = await db.devworks.update_one(tenant_filter(user, {"id": dev_id}), {"$set": {"status": status, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.devworks.find_one(tenant_filter(user, {"id": dev_id}), {"_id": 0})
    try:
        await v2dw.sync_devwork_status(db, devwork=doc, status=status, actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for devwork status")
    return doc


# ----------------- WORKER actions -----------------
@api.post("/issues/{issue_id}/request-reassign")
async def request_reassign(issue_id: str, reason: str = Query(""), user: dict = Depends(require_roles("worker"))):
    issue = await db.issues.find_one(tenant_filter(user, {"id": issue_id}))
    if not issue or issue.get("assigned_to") != user["id"]:
        raise HTTPException(403, "Not your assignment")
    if issue.get("status") == "Reassignment Requested":
        raise HTTPException(400, "Reassignment already pending")
    reassignment = {
        "requested_by": user["id"],
        "requested_by_name": user["name"],
        "reason": reason or "",
        "at": now_iso(),
        "status": "Pending",
    }
    await db.issues.update_one(
        tenant_filter(user, {"id": issue_id}),
        {
            "$set": {"status": "Reassignment Requested", "updated_at": now_iso(), "reassignment_request": reassignment},
            "$push": {"timeline": {"status": "Reassignment Requested", "at": now_iso(), "by": user["name"], "note": reason or "Worker requested reassignment"}},
        },
    )
    return {"ok": True}


@api.post("/issues/{issue_id}/approve-reassign")
async def approve_reassign(issue_id: str, new_worker_id: str = Query(...), user: dict = Depends(require_roles("pa", "admin"))):
    worker = await db.users.find_one(tenant_filter(user, {"id": new_worker_id, "role": "worker"}))
    if not worker:
        raise HTTPException(404, "Worker not found")
    issue = await db.issues.find_one(tenant_filter(user, {"id": issue_id}))
    if not issue:
        raise HTTPException(404, "Issue not found")
    # Preserve workflow context: if work was already in progress, the new worker
    # takes over without resetting the status. Otherwise, mark as Assigned.
    prev_timeline = issue.get("timeline", []) or []
    prev_had_progress = any(
        (t or {}).get("status") == "In Progress" for t in prev_timeline
    )
    new_status = "In Progress" if prev_had_progress else "Assigned"
    mobile_part = f" · Mobile: {worker.get('mobile')}" if worker.get("mobile") else ""
    await db.issues.update_one(
        tenant_filter(user, {"id": issue_id}),
        {
            "$set": {
                "assigned_to": worker["id"],
                "assigned_to_name": worker["name"],
                "status": new_status,
                "updated_at": now_iso(),
                "reassignment_request": None,
            },
            "$push": {"timeline": {"status": "Reassigned", "at": now_iso(), "by": user["name"], "note": f"Reassigned to {worker['name']}{mobile_part}"}},
        },
    )
    try:
        await v2dw.sync_issue_event(
            db, issue_id=issue_id, event_label="Reassigned",
            note=f"Reassigned to {worker['name']}", actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for issue reassign")
    return await db.issues.find_one(tenant_filter(user, {"id": issue_id}), {"_id": 0})


@api.post("/issues/{issue_id}/reject-reassign")
async def reject_reassign(issue_id: str, note: str = Query(""), user: dict = Depends(require_roles("pa", "admin"))):
    issue = await db.issues.find_one(tenant_filter(user, {"id": issue_id}))
    if not issue:
        raise HTTPException(404, "Issue not found")
    # revert to In Progress (issue stays with the original worker)
    await db.issues.update_one(
        tenant_filter(user, {"id": issue_id}),
        {
            "$set": {"status": "In Progress", "updated_at": now_iso(), "reassignment_request": None},
            "$push": {"timeline": {"status": "Reassignment Rejected", "at": now_iso(), "by": user["name"], "note": note or "Continue with original worker"}},
        },
    )
    return await db.issues.find_one(tenant_filter(user, {"id": issue_id}), {"_id": 0})


# ----------------- DASHBOARD -----------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    tf = tenant_filter(user)
    total_citizens = await db.users.count_documents({**tf, "role": "citizen"})
    total_households = await db.households.count_documents(tf)
    total_issues = await db.issues.count_documents(tf)
    resolved = await db.issues.count_documents({**tf, "status": {"$in": ["Resolved", "Verified"]}})
    pending = await db.issues.count_documents({**tf, "status": {"$in": ["New", "Under Review", "Assigned", "In Progress", "Reopened"]}})
    total_workers = await db.users.count_documents({**tf, "role": "worker"})
    total_visits = await db.visits.count_documents(tf)
    total_devworks = await db.devworks.count_documents(tf)

    # category breakdown (tenant-scoped via $match before $group)
    cat_pipeline = [{"$match": tf}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    cats = [{"category": c["_id"], "count": c["count"]} async for c in db.issues.aggregate(cat_pipeline)]

    # status breakdown
    status_pipeline = [{"$match": tf}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    statuses = [{"status": s["_id"], "count": s["count"]} async for s in db.issues.aggregate(status_pipeline)]

    # ward performance
    ward_pipeline = [{"$match": tf}, {"$group": {"_id": "$ward_id", "total": {"$sum": 1}, "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["Resolved", "Verified"]]}, 1, 0]}}}}]
    wards = [{"ward_id": w["_id"], "total": w["total"], "resolved": w["resolved"]} async for w in db.issues.aggregate(ward_pipeline)]

    return {
        "total_citizens": total_citizens,
        "total_households": total_households,
        "total_issues": total_issues,
        "resolved_issues": resolved,
        "pending_issues": pending,
        "total_workers": total_workers,
        "total_visits": total_visits,
        "total_devworks": total_devworks,
        "by_category": cats,
        "by_status": statuses,
        "by_ward": wards,
    }


@api.get("/dashboard/citizen-stats")
async def citizen_stats(user: dict = Depends(get_current_user)):
    if user["role"] != "citizen":
        raise HTTPException(403, "Citizens only")
    total = await db.issues.count_documents(tenant_filter(user, {"citizen_id": user["id"]}))
    resolved = await db.issues.count_documents(tenant_filter(user, {"citizen_id": user["id"], "status": {"$in": ["Resolved", "Verified"]}}))
    pending = total - resolved
    return {"total": total, "resolved": resolved, "pending": pending}


# ----------------- FILES -----------------
MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}


@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename or "bin").split(".")[-1].lower()
    ctype = MIME.get(ext, file.content_type or "application/octet-stream")
    data = await file.read()
    file_id = new_id()
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    storage_ok = False
    try:
        result = put_object(path, data, ctype)
        path = result["path"]
        storage_ok = True
    except Exception as e:
        logger.warning(f"Object storage upload failed, falling back to DB: {e}")
    rec = {
        "id": file_id,
        "tenant_id": user.get("tenant_id"),
        "storage_path": path,
        "original_filename": file.filename,
        "content_type": ctype,
        "size": len(data),
        "is_deleted": False,
        "in_db": not storage_ok,
        "created_at": now_iso(),
        "uploaded_by": user["id"],
    }
    if not storage_ok:
        # store bytes directly in DB as fallback
        import base64
        rec["data_b64"] = base64.b64encode(data).decode("ascii")
    await db.files.insert_one(rec)
    return {"path": path, "url": f"/api/files/{path}"}


@api.get("/files/{path:path}")
async def serve_file(path: str, user: dict = Depends(get_current_user_flexible)):
    if not await can_access_file(user, path):
        raise HTTPException(403, "Forbidden")
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if rec and rec.get("in_db") and rec.get("data_b64"):
        import base64
        return Response(content=base64.b64decode(rec["data_b64"]), media_type=rec.get("content_type", "application/octet-stream"))
    try:
        data, ctype = get_object(path)
    except Exception:
        raise HTTPException(404, "Not found")
    return Response(content=data, media_type=ctype)


@api.get("/portal-asset/{path:path}")
async def serve_portal_asset(path: str):
    """PUBLIC endpoint serving portal branding assets (logo / hero / favicon).

    The image bug: earlier all files were behind auth so citizens visiting the
    branded portal (before login) could not see logos. Portal branding is
    inherently public — we scope this endpoint to only paths that are actually
    referenced from portal_configs (logo_path, hero_image_path, favicon_path).
    """
    referenced = await db.portal_configs.find_one(
        {"$or": [
            {"logo_path": path},
            {"hero_image_path": path},
            {"favicon_path": path},
        ]},
        {"id": 1},
    )
    if not referenced:
        raise HTTPException(404, "Not a portal asset")
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if rec and rec.get("in_db") and rec.get("data_b64"):
        import base64
        return Response(
            content=base64.b64decode(rec["data_b64"]),
            media_type=rec.get("content_type", "application/octet-stream"),
            headers={"Cache-Control": "public, max-age=3600"},
        )
    try:
        data, ctype = get_object(path)
    except Exception:
        raise HTTPException(404, "Not found")
    return Response(content=data, media_type=ctype,
                    headers={"Cache-Control": "public, max-age=3600"})


# ----------------- REPORTS -----------------
def _csv_response(filename: str, rows: list[dict], cols: list[str]) -> Response:
    lines = [",".join(cols)]
    for r in rows:
        vals = []
        for c in cols:
            v = r.get(c, "")
            v = "" if v is None else str(v).replace(",", " ").replace("\n", " ")
            vals.append(v)
        lines.append(",".join(vals))
    return Response(
        "\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@api.get("/reports/issues.csv")
async def report_issues_csv(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    issues = await db.issues.find(tenant_filter(user), {"_id": 0}).to_list(20000)
    cols = ["issue_code", "category", "title", "status", "assigned_to_name", "rating", "created_at"]
    return _csv_response("issues.csv", issues, cols)


@api.get("/reports/households.csv")
async def report_households_csv(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    hh = await db.households.find(tenant_filter(user), {"_id": 0}).to_list(20000)
    cols = ["household_code", "family_head_name", "house_number", "region_type",
            "address", "members_count", "created_at"]
    return _csv_response("households.csv", hh, cols)


@api.get("/reports/citizens.csv")
async def report_citizens_csv(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    rows = await db.users.find(
        tenant_filter(user, {"role": "citizen"}),
        {"_id": 0, "id": 1, "name": 1, "mobile": 1, "gender": 1, "dob": 1,
         "address": 1, "house_number": 1, "region_type": 1, "status": 1,
         "is_active": 1, "created_at": 1},
    ).to_list(50000)
    cols = ["id", "name", "mobile", "gender", "dob", "house_number", "region_type",
            "address", "status", "is_active", "created_at"]
    return _csv_response("citizens.csv", rows, cols)


@api.get("/reports/devworks.csv")
async def report_devworks_csv(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    rows = await db.devworks.find(tenant_filter(user), {"_id": 0}).to_list(20000)
    cols = ["title", "category", "status", "approved", "budget", "location", "created_at"]
    return _csv_response("devworks.csv", rows, cols)


@api.get("/reports/visits.csv")
async def report_visits_csv(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    rows = await db.visits.find(tenant_filter(user), {"_id": 0}).to_list(20000)
    cols = ["title", "visit_type", "date", "time", "location", "status",
            "target_audience", "created_at"]
    return _csv_response("visits.csv", rows, cols)


@api.get("/reports/summary")
async def report_summary(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    """Lightweight numbers report for the Reports page header."""
    base = tenant_filter(user)
    citizens = await db.users.count_documents({**base, "role": "citizen"})
    households = await db.households.count_documents(base)
    issues = await db.issues.count_documents(base)
    resolved = await db.issues.count_documents({**base, "status": {"$in": ["Resolved", "Verified"]}})
    devworks = await db.devworks.count_documents(base)
    visits = await db.visits.count_documents(base)
    return {
        "citizens": citizens, "households": households,
        "issues": issues, "issues_resolved": resolved,
        "devworks": devworks, "visits": visits,
    }



# ----------------- PERSON MASTER / FAMILY GRAPH / SERVICE HISTORY (long-term vision foundation) -----------------
@api.get("/meta/relation-types")
async def relation_types():
    return {"relation_types": RELATION_TYPES}


@api.get("/persons/{person_id}")
async def person_profile(person_id: str, user: dict = Depends(get_current_user)):
    # Citizens may only view their own person profile; staff may view any (within their tenant).
    if not is_staff(user) and user["id"] != person_id:
        raise HTTPException(403, "Forbidden")
    person = await db.users.find_one(tenant_filter(user, {"id": person_id}), {"_id": 0, "password_hash": 0})
    if not person:
        raise HTTPException(404, "Person not found")
    rels = await db.relationships.find(tenant_filter(user, {"$or": [{"person_a": person_id}, {"person_b": person_id}]}), {"_id": 0}).to_list(500)
    other_ids = [r["person_b"] if r["person_a"] == person_id else r["person_a"] for r in rels]
    others = {u["id"]: u async for u in db.users.find(tenant_filter(user, {"id": {"$in": other_ids}}), {"_id": 0, "password_hash": 0})}
    for r in rels:
        is_a = r["person_a"] == person_id
        other_id = r["person_b"] if is_a else r["person_a"]
        other = others.get(other_id)
        r["other"] = other
        if not is_a:
            r["display_type"] = r["type"]
        else:
            r["display_type"] = inverse_relation(r["type"], (other or {}).get("gender"))
    interactions = await db.interactions.find(tenant_filter(user, {"person_id": person_id}), {"_id": 0}).sort("occurred_at", -1).to_list(500)
    issues = await db.issues.find(tenant_filter(user, {"citizen_id": person_id}), {"_id": 0}).sort("created_at", -1).to_list(500)
    # Transfer banner: if the V1 user row was transferred OUT we surface the
    # archived membership row in their tenant so the staff UI can render
    # "Transferred to <Org>" with date + new org details.
    transfer_banner = None
    if person.get("is_active") is False and person.get("_transferred_out_to_user_id"):
        pid_v2 = person.get("person_id")
        archived_mem = await db.memberships.find_one(
            {"person_id": pid_v2, "organisation_id": person.get("tenant_id"),
             "status": "archived"},
            {"_id": 0}, sort=[("end_date", -1)],
        ) if pid_v2 else None
        to_org = None
        if archived_mem and archived_mem.get("transferred_to_organisation_id"):
            to_org = await db.portal_configs.find_one(
                {"id": archived_mem["transferred_to_organisation_id"]},
                {"_id": 0, "id": 1, "slug": 1, "politician_name": 1,
                 "tenant_name": 1, "constituency_name": 1},
            )
        transfer_banner = {
            "kind": "transferred_out",
            "archived_membership": archived_mem,
            "to_organisation": to_org,
            "transferred_at": (archived_mem or {}).get("end_date"),
            "reason": (archived_mem or {}).get("transfer_reason"),
            "read_only": True,
        }
    return {"person": person, "relationships": rels, "interactions": interactions,
            "issues": issues, "transfer_banner": transfer_banner}


@api.put("/persons/{person_id}")
async def update_person(person_id: str, payload: dict, user: dict = Depends(require_roles("pa", "politician", "admin"))):
    allowed = {"anniversary", "occupation", "profile_photo", "notes", "status", "date_of_death",
               "supporter_since", "political_role", "influence_level", "political_notes", "family_lineage"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(400, "No allowed fields")
    res = await db.users.update_one(tenant_filter(user, {"id": person_id}), {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Person not found")
    try:
        await v2dw.sync_person_profile_update(
            db, user_id=person_id, updates=update, actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for profile update")
    return await db.users.find_one(tenant_filter(user, {"id": person_id}), {"_id": 0, "password_hash": 0})


@api.post("/relationships")
async def create_relationship(payload: RelationshipCreate, user: dict = Depends(require_roles("pa", "admin"))):
    if payload.type not in RELATION_TYPES:
        raise HTTPException(400, "Invalid relation type")
    if payload.person_a == payload.person_b:
        raise HTTPException(400, "Cannot create a relationship with the same person")
    # Both persons must exist AND be in the same tenant as the user creating the edge.
    pa = await db.users.find_one(tenant_filter(user, {"id": payload.person_a}))
    pb = await db.users.find_one(tenant_filter(user, {"id": payload.person_b}))
    if not pa or not pb:
        raise HTTPException(404, "Person not found")
    # Prevent exact duplicate edge (same direction + same type) within tenant
    existing = await db.relationships.find_one(tenant_filter(user, {
        "person_a": payload.person_a,
        "person_b": payload.person_b,
        "type": payload.type,
    }))
    if existing:
        raise HTTPException(409, "This relationship already exists")
    r = Relationship(**payload.model_dump(), tenant_id=get_tenant_id_for_write(user))
    await db.relationships.insert_one(r.model_dump())
    try:
        await v2dw.sync_relationship_to_v2(db, rel=r.model_dump(), actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for relationship creation")
    return await db.relationships.find_one({"id": r.id}, {"_id": 0}) or r.model_dump()


@api.delete("/relationships/{rel_id}")
async def delete_relationship(rel_id: str, user: dict = Depends(require_roles("pa", "admin"))):
    await db.relationships.delete_one(tenant_filter(user, {"id": rel_id}))
    try:
        await v2dw.revoke_relationship_v2(db, rel_id=rel_id, actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for relationship delete")
    return {"ok": True}


@api.post("/interactions")
async def create_interaction(payload: ServiceInteractionCreate, user: dict = Depends(require_roles("worker", "pa", "admin"))):
    data = payload.model_dump()
    if not data.get("occurred_at"):
        data["occurred_at"] = now_iso()
    if data.get("worker_id"):
        w = await db.users.find_one(tenant_filter(user, {"id": data["worker_id"]}))
        if w:
            data["worker_name"] = w["name"]
    elif user["role"] == "worker":
        data["worker_id"] = user["id"]
        data["worker_name"] = user["name"]
    interaction = ServiceInteraction(**data, tenant_id=get_tenant_id_for_write(user))
    await db.interactions.insert_one(interaction.model_dump())
    # M3 dual-write — fetch subject user for lazy person-mirror.
    try:
        subject = await db.users.find_one({"id": interaction.person_id})
        await v2dw.sync_interaction_to_v2(
            db, interaction=interaction.model_dump(),
            subject_user=subject, actor_user=user)
    except Exception:
        logger.exception("V2 dualwrite skipped for interaction creation")
    return await db.interactions.find_one({"id": interaction.id}, {"_id": 0}) or interaction.model_dump()


@api.get("/dashboard/celebrations")
async def celebrations(days: int = 7, user: dict = Depends(require_roles("pa", "politician", "admin"))):
    from datetime import date
    today = date.today()
    # Projection: load only the fields the bucketing logic actually uses
    # (avoid pulling full 5000-doc user records each call).
    projection = {
        "_id": 0, "id": 1, "name": 1, "mobile": 1, "ward_id": 1, "village_id": 1,
        "household_id": 1, "dob": 1, "anniversary": 1, "date_of_death": 1,
        "status": 1, "gender": 1, "profile_photo": 1,
    }
    citizens_alive = await db.users.find(
        tenant_filter(user, {"role": "citizen", "status": {"$ne": "deceased"}}),
        projection,
    ).to_list(5000)
    citizens_dead = await db.users.find(
        tenant_filter(user, {"role": "citizen", "status": "deceased"}),
        projection,
    ).to_list(5000)

    def _bucket(field, deceased_only=False):
        out = {"today": [], "upcoming": []}
        pool = citizens_dead if deceased_only else citizens_alive
        for c in pool:
            s = c.get(field)
            if not s or len(s) < 10:
                continue
            md = s[5:10]
            tmd = today.strftime("%m-%d")
            if md == tmd:
                out["today"].append(c)
            else:
                try:
                    this_year_dt = datetime.strptime(f"{today.year}-{md}", "%Y-%m-%d").date()
                    diff = (this_year_dt - today).days
                    if 0 < diff <= days:
                        out["upcoming"].append({**c, "in_days": diff})
                except Exception:
                    pass
        return out

    return {"birthdays": _bucket("dob"), "anniversaries": _bucket("anniversary"), "remembrance": _bucket("date_of_death", deceased_only=True)}



# ----------------- WHITE-LABEL PORTAL -----------------
import re


def _normalize_slug(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def _public_portal(p: dict) -> dict:
    """Strip internal fields for public consumption."""
    if not p:
        return p
    out = {k: v for k, v in p.items() if k != "_id"}
    return out


@api.get("/portals")
async def list_portals_public():
    """Public list of active portals (compact)."""
    docs = await db.portal_configs.find({"is_active": True}, {"_id": 0}).to_list(200)
    fields = {"id", "slug", "politician_name", "designation", "constituency_name", "logo_path", "theme_color", "is_default"}
    return [{k: d.get(k) for k in fields} for d in docs]


@api.get("/portals/{slug}")
async def get_portal_public(slug: str):
    p = await db.portal_configs.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Portal not found")
    return _public_portal(p)


@api.get("/portals/{slug}/devworks")
async def portal_devworks(slug: str, limit: int = 6):
    p = await db.portal_configs.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Portal not found")
    q = {"approved": True}
    if p.get("constituency_id"):
        # filter by ward/village that belongs to this constituency
        areas = await db.areas.find({"constituency_id": p["constituency_id"]}, {"id": 1}).to_list(500)
        area_ids = [a["id"] for a in areas]
        q["$or"] = [{"ward_id": {"$in": area_ids}}, {"village_id": {"$in": area_ids}}]
    docs = await db.devworks.find(q, {"_id": 0}).sort("created_at", -1).limit(max(1, min(limit, 50))).to_list(50)
    return docs


@api.get("/portals/{slug}/visits")
async def portal_visits(slug: str, limit: int = 5):
    p = await db.portal_configs.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Portal not found")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    q = {"status": {"$in": ["Approved", "Published"]}, "date": {"$gte": today}}
    if p.get("constituency_id"):
        areas = await db.areas.find({"constituency_id": p["constituency_id"]}, {"id": 1}).to_list(500)
        area_ids = [a["id"] for a in areas]
        # visits are tagged with ward_ids/village_ids lists or untagged (all)
        q["$or"] = [
            {"ward_ids": {"$in": area_ids}},
            {"village_ids": {"$in": area_ids}},
            {"$and": [{"ward_ids": {"$size": 0}}, {"village_ids": {"$size": 0}}]},
        ]
    docs = await db.visits.find(q, {"_id": 0}).sort("date", 1).limit(max(1, min(limit, 20))).to_list(20)
    return docs


@api.get("/portals/{slug}/notifications")
async def portal_notifications(slug: str, limit: int = 5):
    p = await db.portal_configs.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Portal not found")
    # Only broadcast / public notifications
    q = {"scope": "all"}
    docs = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).limit(max(1, min(limit, 20))).to_list(20)
    return docs


# --- Admin write endpoints ---
@api.get("/admin/portals")
async def list_portals_admin(user: dict = Depends(get_current_user)):
    if user.get("role") not in ("super_admin", "admin"):
        raise HTTPException(403, "Forbidden")
    # Tenant admin sees only their own portal; super_admin sees all.
    q = {} if user.get("role") == "super_admin" else {"id": user.get("tenant_id")}
    return await db.portal_configs.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


def _generate_password(n: int = 12) -> str:
    import secrets, string
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


@api.post("/admin/portals")
async def create_portal(payload: PortalConfigCreate, user: dict = Depends(require_roles("super_admin"))):
    slug = _normalize_slug(payload.slug)
    if not slug:
        raise HTTPException(400, "Invalid slug")
    if await db.portal_configs.find_one({"slug": slug}):
        raise HTTPException(409, "Slug already exists")
    data = payload.model_dump()
    data["slug"] = slug
    # Default trial: 14-day trial, on trial plan, active.
    from datetime import date, timedelta
    today = date.today()
    if not data.get("subscription_start"):
        data["subscription_start"] = today.isoformat()
    if not data.get("trial_expiry"):
        data["trial_expiry"] = (today + timedelta(days=14)).isoformat()
    cfg = PortalConfig(**data)
    if cfg.is_default:
        await db.portal_configs.update_many({}, {"$set": {"is_default": False}})
    await db.portal_configs.insert_one(cfg.model_dump())

    # Auto-provision tenant admin user with a temp password.
    admin_email = (payload.primary_admin_email or f"admin@{slug}.jansetu.in").strip().lower()
    admin_name = payload.primary_admin_name or f"Admin - {cfg.constituency_name}"
    temp_password = _generate_password(12)
    admin_user = User(
        role="admin",
        tenant_id=cfg.id,
        name=admin_name,
        email=admin_email,
        password_hash=hash_password(temp_password),
        must_change_password=True,
    )
    await db.users.insert_one(admin_user.model_dump())
    await db.portal_configs.update_one(
        {"id": cfg.id},
        {"$set": {"primary_admin_email": admin_email, "primary_admin_user_id": admin_user.id, "updated_at": now_iso()}},
    )
    # Return creds in the response ONCE — UI must show them in a copy/print modal and never persist them.
    return {
        "portal": {**cfg.model_dump(), "primary_admin_email": admin_email, "primary_admin_user_id": admin_user.id},
        "credentials": {
            "tenant_admin_email": admin_email,
            "tenant_admin_name": admin_name,
            "temp_password": temp_password,
            "must_change_password": True,
        },
        "urls": {
            "portal_url": f"/portal/{slug}",
            "staff_login_url": f"/staff/login?portal={slug}",
            "citizen_portal_url": f"/portal/{slug}",
        },
    }


@api.post("/admin/portals/{portal_id}/reset-admin-password")
async def reset_admin_password(portal_id: str, user: dict = Depends(require_roles("super_admin"))):
    portal = await db.portal_configs.find_one({"id": portal_id})
    if not portal:
        raise HTTPException(404, "Portal not found")
    admin_id = portal.get("primary_admin_user_id")
    if not admin_id:
        raise HTTPException(404, "Tenant admin not configured for this portal")
    temp_password = _generate_password(12)
    await db.users.update_one(
        {"id": admin_id},
        {"$set": {"password_hash": hash_password(temp_password), "must_change_password": True}},
    )
    return {"tenant_admin_email": portal.get("primary_admin_email"), "temp_password": temp_password}


@api.put("/admin/portals/{portal_id}")
async def update_portal(portal_id: str, payload: dict, _: dict = Depends(require_roles("admin"))):
    allowed = {
        "politician_name", "designation", "constituency_name", "constituency_id",
        "welcome_message", "tagline",
        "logo_path", "hero_image_path", "theme_color", "accent_color",
        "contact_phone", "contact_email", "contact_address", "office_hours", "social_links",
        "is_active", "slug",
    }
    update = {k: v for k, v in payload.items() if k in allowed}
    if "slug" in update:
        update["slug"] = _normalize_slug(update["slug"])
        if not update["slug"]:
            raise HTTPException(400, "Invalid slug")
        clash = await db.portal_configs.find_one({"slug": update["slug"], "id": {"$ne": portal_id}})
        if clash:
            raise HTTPException(409, "Slug already exists")
    if not update:
        raise HTTPException(400, "No allowed fields")
    update["updated_at"] = now_iso()
    res = await db.portal_configs.update_one({"id": portal_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Portal not found")
    return await db.portal_configs.find_one({"id": portal_id}, {"_id": 0})


@api.post("/admin/portals/{portal_id}/set-default")
async def set_default_portal(portal_id: str, _: dict = Depends(require_roles("admin"))):
    target = await db.portal_configs.find_one({"id": portal_id})
    if not target:
        raise HTTPException(404, "Portal not found")
    await db.portal_configs.update_many({}, {"$set": {"is_default": False}})
    await db.portal_configs.update_one({"id": portal_id}, {"$set": {"is_default": True, "is_active": True, "updated_at": now_iso()}})
    return await db.portal_configs.find_one({"id": portal_id}, {"_id": 0})


@api.delete("/admin/portals/{portal_id}")
async def delete_portal(portal_id: str, _: dict = Depends(require_roles("admin"))):
    # Soft delete: mark inactive and remove default flag
    res = await db.portal_configs.update_one({"id": portal_id}, {"$set": {"is_active": False, "is_default": False, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Portal not found")
    return {"ok": True}


@api.post("/admin/portals/{portal_id}/suspend")
async def suspend_portal(portal_id: str, _: dict = Depends(require_roles("admin"))):
    res = await db.portal_configs.update_one(
        {"id": portal_id},
        {"$set": {"portal_status": "suspended", "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Portal not found")
    return await db.portal_configs.find_one({"id": portal_id}, {"_id": 0})


@api.post("/admin/portals/{portal_id}/activate")
async def activate_portal(portal_id: str, _: dict = Depends(require_roles("admin"))):
    res = await db.portal_configs.update_one(
        {"id": portal_id},
        {"$set": {"portal_status": "active", "is_active": True, "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Portal not found")
    return await db.portal_configs.find_one({"id": portal_id}, {"_id": 0})


# ----------------- PLATFORM (Super Admin) -----------------
@api.get("/admin/v2/parity")
async def v2_parity(user: dict = Depends(get_current_user)):
    """M3 — Parity report between V1 (authoritative) and V2 (shadow) collections.

    Super-admin only. Returns a structured report; each check has `ok: bool`
    and `delta: int`. Use as input to the nightly alerting job during the
    dual-write window.
    """
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    return await v2dw.parity_report(db)


@api.get("/admin/v2/integrity")
async def v2_integrity(user: dict = Depends(get_current_user)):
    """Full DB integrity audit — orphaned records, broken FKs, duplicates.
    Read-only. Super-admin only."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    from migrations.integrity_audit import run
    return await run(db)


@api.post("/admin/v2/integrity/cleanup")
async def v2_integrity_cleanup(
    dry_run: bool = True,
    user: dict = Depends(get_current_user),
):
    """Cleanup orphaned rows. Defaults to dry_run=true. Super-admin only.
    Call with `?dry_run=false` to actually apply."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    from migrations.integrity_cleanup import cleanup
    return await cleanup(db, apply=not dry_run)



@api.post("/admin/v2/parity/backfill-missing")
async def v2_parity_backfill(user: dict = Depends(get_current_user)):
    """M3 — Best-effort: lazy-create Persons for any V1 users missing a V2
    mirror, and re-stamp operational records whose person_id/origin_membership_id
    are NULL. Super-admin only. Returns counts.
    """
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    minted = 0
    stamped = {"issues": 0, "interactions": 0}
    # 1) Lazy mirror users (creates Persons + missing memberships). Idempotent.
    async for u in db.users.find({}, {"_id": 0, "password_hash": 0}):
        existed = await db["_v2_user_to_person"].find_one({"_id": u["id"]})
        pid = await v2dw.ensure_person_for_user(db, u)
        if pid and not existed:
            minted += 1
    # 2) Re-stamp issues that have no person_id OR no origin_membership_id.
    async for i in db.issues.find(
        {"$or": [
            {"person_id": None}, {"person_id": {"$exists": False}},
            {"origin_membership_id": None}, {"origin_membership_id": {"$exists": False}},
        ]},
        {"_id": 0},
    ):
        cu = await db.users.find_one({"id": i.get("citizen_id")})
        await v2dw.sync_issue_to_v2(db, i, citizen_user=cu)
        stamped["issues"] += 1
    # 3) Re-stamp interactions that have no person_id (or whose subject not mirrored).
    async for it in db.interactions.find({"$or": [{"origin_membership_id": None}, {"origin_membership_id": {"$exists": False}}]}, {"_id": 0}):
        cu = await db.users.find_one({"id": it.get("person_id")})
        await v2dw.sync_interaction_to_v2(db, interaction=it, subject_user=cu, actor_user=user)
        stamped["interactions"] += 1
    # 4) Re-stamp staff-owned records (visits / notifications / devworks).
    for col, helper in (
        ("visits", v2dw.sync_visit_to_v2),
        ("notifications", v2dw.sync_notification_to_v2),
        ("devworks", v2dw.sync_devwork_to_v2),
    ):
        stamped[col] = 0
        async for d in db[col].find(
            {"$or": [{"origin_membership_id": None},
                     {"origin_membership_id": {"$exists": False}}]},
            {"_id": 0},
        ):
            creator_id = d.get("created_by")
            actor = await db.users.find_one({"id": creator_id}) if creator_id else None
            if not actor:
                continue
            kw = {col[:-1]: d, "actor_user": actor}  # visit=..., notification=..., devwork=...
            await helper(db, **kw)
            stamped[col] += 1
    return {"persons_minted": minted, "records_stamped": stamped}


@api.get("/platform/stats")
async def platform_stats(user: dict = Depends(get_current_user)):
    """Platform-wide aggregate counts. Super-admin only.
    Returns only counts; never per-tenant data.
    """
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")

    total_portals = await db.portal_configs.count_documents({})
    active_portals = await db.portal_configs.count_documents({"is_active": True, "portal_status": {"$ne": "suspended"}})
    suspended_portals = await db.portal_configs.count_documents({"portal_status": "suspended"})
    trial_portals = await db.portal_configs.count_documents({"is_trial": True, "is_active": True})

    # Platform-wide entity counts (across all tenants).
    total_citizens = await db.users.count_documents({"role": "citizen"})
    total_staff = await db.users.count_documents({"role": {"$in": ["worker", "pa", "politician", "admin"]}})
    total_issues = await db.issues.count_documents({})
    total_visits = await db.visits.count_documents({})
    total_notifications = await db.notifications.count_documents({})
    total_devworks = await db.devworks.count_documents({})

    return {
        "portals": {
            "total": total_portals,
            "active": active_portals,
            "suspended": suspended_portals,
            "trial": trial_portals,
        },
        "entities": {
            "citizens": total_citizens,
            "staff": total_staff,
            "issues": total_issues,
            "visits": total_visits,
            "notifications": total_notifications,
            "devworks": total_devworks,
        },
    }


# ----------------- SEED -----------------
async def seed_demo_data():
    logger.info("Seeding demo data...")

    # Constituency
    constituency = Constituency(name="Pune Cantonment", state="Maharashtra", type="mixed", politician_name="Hon. Rajesh Patil")
    await db.constituencies.insert_one(constituency.model_dump())

    # Wards (urban)
    wards = []
    for i, name in enumerate(["Ward 1 - Camp", "Ward 2 - Wanowrie", "Ward 3 - Ghorpadi", "Ward 4 - Lullanagar"]):
        a = Area(constituency_id=constituency.id, name=name, kind="ward", region_type="urban")
        await db.areas.insert_one(a.model_dump())
        wards.append(a)

    # Villages (rural)
    villages = []
    for name in ["Hadapsar Gaon", "Mundhwa", "Kondhwa Khurd"]:
        a = Area(constituency_id=constituency.id, name=name, kind="village", region_type="rural")
        await db.areas.insert_one(a.model_dump())
        villages.append(a)

    # Users
    admin = User(role="admin", name="Super Admin", email="admin@jansetu.in", password_hash=hash_password("admin123"))
    politician = User(role="politician", name="Hon. Rajesh Patil", email="mla@jansetu.in", password_hash=hash_password("mla123"), designation="MLA, Pune Cantonment")
    pa = User(role="pa", name="Priya Deshmukh", email="pa@jansetu.in", password_hash=hash_password("pa123"), designation="Personal Assistant")
    worker1 = User(role="worker", name="Suresh Kale", email="worker1@jansetu.in", password_hash=hash_password("worker123"), designation="Field Coordinator")
    worker2 = User(role="worker", name="Anita Joshi", email="worker2@jansetu.in", password_hash=hash_password("worker123"), designation="Engineer")

    await db.users.insert_many([admin.model_dump(), politician.model_dump(), pa.model_dump(), worker1.model_dump(), worker2.model_dump()])

    # Demo citizen + household
    hh_seq = await next_seq("household")
    hh = Household(
        household_code=f"H-{10000 + hh_seq}",
        family_head_name="Ramesh Sharma",
        address="Plot 22, MG Road, Camp",
        house_number="22",
        region_type="urban",
        ward_id=wards[0].id,
        members_count=4,
    )
    await db.households.insert_one(hh.model_dump())

    citizen = User(
        role="citizen",
        name="Ramesh Sharma",
        mobile="9999900001",
        gender="Male",
        household_id=hh.id,
        region_type="urban",
        ward_id=wards[0].id,
        house_number="22",
        address="Plot 22, MG Road, Camp",
    )
    await db.users.insert_one(citizen.model_dump())

    # Sample issues
    samples = [
        ("Road", "Large pothole near MG Road", "Pothole causing accidents near junction.", "Resolved"),
        ("Water Supply", "No water for 3 days", "Tanker has not arrived.", "In Progress"),
        ("Street Light", "Street light broken", "Dark stretch on side lane.", "Assigned"),
        ("Garbage", "Garbage not collected", "Garbage piling near Plot 30.", "New"),
    ]
    for cat, title, desc, status in samples:
        seq = await next_seq("issue")
        i = Issue(
            issue_code=f"ISS-{10000 + seq}",
            citizen_id=citizen.id,
            household_id=hh.id,
            category=cat,
            title=title,
            description=desc,
            ward_id=wards[0].id,
            status=status,
            assigned_to=worker1.id if status != "New" else None,
            assigned_to_name=worker1.name if status != "New" else None,
            timeline=[{"status": "New", "at": now_iso(), "by": citizen.name, "note": "Issue raised"}],
        )
        await db.issues.insert_one(i.model_dump())

    # Visits
    v = Visit(
        title="Janata Darbar - Camp Ward",
        description="Open meeting with citizens",
        date=(datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
        time="10:00",
        location="Ward 1 Community Hall",
        visit_type="Janata Darbar",
        target_audience="All residents",
        ward_ids=[wards[0].id],
        status="Approved",
        approved_by=politician.id,
        approved_at=now_iso(),
        created_by=pa.id,
    )
    await db.visits.insert_one(v.model_dump())

    # Notifications
    n = Notification(
        title="Free Health Camp this Sunday",
        body="A free health camp will be organized at Ward 2 Community Center, 9 AM - 5 PM.",
        notif_type="Health Camp",
        scope="all",
        created_by=pa.id,
    )
    await db.notifications.insert_one(n.model_dump())

    # Dev works
    for title, cat, status, approved in [
        ("Road Resurfacing - MG Road", "Road Construction", "Work Started", True),
        ("New Water Tank - Wanowrie", "Water Tank", "Approved", True),
        ("Drainage Project Phase 2", "Drainage Project", "Tender Issued", True),
        ("Street Light Installation", "Street Light Installation", "Completed", True),
    ]:
        d = DevWork(
            title=title,
            description=f"{title} - public infrastructure project.",
            category=cat,
            location="Pune Cantonment",
            ward_id=wards[0].id,
            status=status,
            budget=2500000,
            approved=approved,
            approved_by=politician.id if approved else None,
            approved_at=now_iso() if approved else None,
            created_by=politician.id,
        )
        await db.devworks.insert_one(d.model_dump())

    # White-label portal config for this constituency
    portal = PortalConfig(
        slug="pune-cantonment",
        is_active=True,
        is_default=True,
        politician_name="Hon. Rajesh Patil",
        designation="MLA, Pune Cantonment",
        constituency_name="Pune Cantonment",
        constituency_id=constituency.id,
        welcome_message="Welcome to our digital constituency. Together, we build a stronger, cleaner, more accountable Pune Cantonment.",
        tagline="Sewa. Suvidha. Sashaktikaran.",
        theme_color="#0A1128",
        contact_phone="+91 20 2612 0000",
        contact_email="office@pune-cantonment.in",
        contact_address="MLA Office, Camp, Pune - 411001",
        office_hours="Mon - Sat, 10:00 AM to 6:00 PM",
        social_links={
            "facebook": "https://facebook.com/rajeshpatil.mla",
            "twitter": "https://twitter.com/rajeshpatil",
            "whatsapp": "https://wa.me/912026120000",
        },
    )
    await db.portal_configs.insert_one(portal.model_dump())

    logger.info("Seed complete.")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)



# ============================================================================
# CASTE / RELIGION (Tenant-scoped taxonomy)
# ============================================================================
@api.get("/castes")
async def list_castes(user: dict = Depends(get_current_user)):
    return await db.castes.find(tenant_filter(user), {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/castes")
async def create_caste(payload: TaxonomyCreate, user: dict = Depends(require_roles("pa", "admin"))):
    tid = get_tenant_id_for_write(user)
    doc = Caste(tenant_id=tid, **payload.model_dump()).model_dump()
    await db.castes.insert_one(dict(doc))
    return doc


@api.delete("/castes/{cid}")
async def delete_caste(cid: str, user: dict = Depends(require_roles("admin"))):
    await db.castes.delete_one(tenant_filter(user, {"id": cid}))
    return {"ok": True}


@api.get("/religions")
async def list_religions(user: dict = Depends(get_current_user)):
    return await db.religions.find(tenant_filter(user), {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/religions")
async def create_religion(payload: TaxonomyCreate, user: dict = Depends(require_roles("pa", "admin"))):
    tid = get_tenant_id_for_write(user)
    doc = Religion(tenant_id=tid, **payload.model_dump()).model_dump()
    await db.religions.insert_one(dict(doc))
    return doc


@api.delete("/religions/{rid}")
async def delete_religion(rid: str, user: dict = Depends(require_roles("admin"))):
    await db.religions.delete_one(tenant_filter(user, {"id": rid}))
    return {"ok": True}


# ============================================================================
# FAMILY LINKING (Citizen self-service) — creates relationship if target exists,
# else creates a Pending Family Invitation.
# ============================================================================
def _inverse_relation(rel: str, target_gender: Optional[str]) -> str:
    """Returns the reciprocal relation label for the target person."""
    from models import INVERSE_RELATION
    pair = INVERSE_RELATION.get(rel, ("Other", "Other"))
    g = (target_gender or "").lower()
    return pair[1] if g in ("female", "f") else pair[0]


@api.post("/family/link")
async def family_link(payload: FamilyLinkRequest, user: dict = Depends(get_current_user)):
    """Citizen initiates a family link by mobile.
    - If mobile is registered in same tenant → create Relationship immediately.
    - Else → create Pending FamilyInvitation, do NOT create a citizen account.
    """
    if user.get("role") != "citizen":
        raise HTTPException(403, "Only citizens can link family members")
    tid = user.get("tenant_id")
    target = await db.users.find_one({
        "mobile": payload.mobile.strip(), "role": "citizen",
        "tenant_id": tid, "is_active": True,
    }, {"_id": 0, "password_hash": 0})
    if target:
        # Create V1 relationship
        rel_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": tid,
            "person_a": user["id"],
            "person_b": target["id"],
            "type": payload.relation_type,
            "created_at": now_iso(),
        }
        await db.relationships.insert_one(rel_doc)
        # V2 mirror
        try:
            await v2dw.sync_relationship_to_v2(db, rel=rel_doc, actor_user=user)
        except Exception:
            logger.exception("family_link dualwrite")
        # For Husband/Wife: capture anniversary on both users
        if payload.relation_type in ("Husband", "Wife") and payload.marriage_anniversary:
            await db.users.update_many(
                {"id": {"$in": [user["id"], target["id"]]}},
                {"$set": {"marriage_anniversary": payload.marriage_anniversary}},
            )
        return {"linked": True, "target": target, "relationship_id": rel_doc["id"]}

    # Not registered → pending invitation
    inv = FamilyInvitation(
        tenant_id=tid,
        from_user_id=user["id"],
        from_person_id=user.get("person_id") or "",
        target_mobile=payload.mobile.strip(),
        target_name=payload.target_name,
        relation_type=payload.relation_type,
        marriage_anniversary=payload.marriage_anniversary,
    ).model_dump()
    await db.family_invitations.insert_one(inv)
    return {"linked": False, "invitation_id": inv["id"], "pending": True}


@api.get("/family/invitations")
async def list_family_invitations(user: dict = Depends(get_current_user)):
    """Citizen sees invitations they SENT (pending) and any they can accept
    (target_mobile matches theirs, status=pending)."""
    outgoing = await db.family_invitations.find(
        {"from_user_id": user["id"], "status": "pending"}, {"_id": 0}
    ).to_list(200)
    incoming = []
    if user.get("mobile"):
        incoming = await db.family_invitations.find(
            {"target_mobile": user["mobile"], "status": "pending"}, {"_id": 0}
        ).to_list(200)
    return {"outgoing": outgoing, "incoming": incoming}


@api.post("/family/invitations/{inv_id}/accept")
async def accept_family_invitation(inv_id: str, user: dict = Depends(get_current_user)):
    inv = await db.family_invitations.find_one({"id": inv_id, "status": "pending"})
    if not inv:
        raise HTTPException(404, "Invitation not found or already resolved")
    if (user.get("mobile") or "") != inv["target_mobile"]:
        raise HTTPException(403, "This invitation is for a different mobile")
    # Create reciprocal relationship
    rel_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": inv["tenant_id"],
        "person_a": inv["from_user_id"],
        "person_b": user["id"],
        "type": inv["relation_type"],
        "created_at": now_iso(),
    }
    await db.relationships.insert_one(rel_doc)
    try:
        actor = await db.users.find_one({"id": inv["from_user_id"]})
        await v2dw.sync_relationship_to_v2(db, rel=rel_doc, actor_user=actor or user)
    except Exception:
        pass
    if inv["relation_type"] in ("Husband", "Wife") and inv.get("marriage_anniversary"):
        await db.users.update_many(
            {"id": {"$in": [inv["from_user_id"], user["id"]]}},
            {"$set": {"marriage_anniversary": inv["marriage_anniversary"]}},
        )
    await db.family_invitations.update_one(
        {"id": inv_id},
        {"$set": {"status": "linked", "resolved_user_id": user["id"],
                  "resolved_at": now_iso()}},
    )
    return {"ok": True, "relationship_id": rel_doc["id"]}


@api.post("/family/invitations/{inv_id}/decline")
async def decline_family_invitation(inv_id: str, user: dict = Depends(get_current_user)):
    await db.family_invitations.update_one(
        {"id": inv_id, "target_mobile": user.get("mobile") or ""},
        {"$set": {"status": "declined", "resolved_at": now_iso()}},
    )
    return {"ok": True}


@api.post("/family/invitations/{inv_id}/cancel")
async def cancel_family_invitation(inv_id: str, user: dict = Depends(get_current_user)):
    await db.family_invitations.update_one(
        {"id": inv_id, "from_user_id": user["id"]},
        {"$set": {"status": "cancelled", "resolved_at": now_iso()}},
    )
    return {"ok": True}


# ============================================================================
# KARYAKARTA MODULE
# ============================================================================
@api.get("/karyakartas")
async def list_karyakartas(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    linked = await db.karyakartas.find(tenant_filter(user, {"is_active": True}), {"_id": 0}).sort("name", 1).to_list(5000)
    pending = await db.pending_karyakartas.find(tenant_filter(user, {"status": "pending"}), {"_id": 0}).sort("name", 1).to_list(5000)
    return {"linked": linked, "pending": pending}


async def _create_or_link_karyakarta(*, tid: str, name: str, mobile: str,
                                     designation: Optional[str], actor_id: str,
                                     ward_id: Optional[str] = None,
                                     village_id: Optional[str] = None,
                                     dob: Optional[str] = None,
                                     anniversary: Optional[str] = None,
                                     notes: Optional[str] = None) -> dict:
    mobile = (mobile or "").strip()
    if not mobile or not name:
        raise HTTPException(400, "name and mobile required")
    # If already a citizen in this tenant, attach karyakarta role.
    existing = await db.users.find_one(
        {"mobile": mobile, "tenant_id": tid, "role": "citizen", "is_active": True},
        {"_id": 0, "id": 1, "person_id": 1, "name": 1},
    )
    if existing:
        pid = existing.get("person_id")
        # Ensure Person exists (safety); attach karyakarta type + designation.
        if pid:
            await db.persons.update_one(
                {"id": pid},
                {"$addToSet": {"types": "karyakarta"}, "$set": {"updated_at": now_iso()}},
            )
        # Attach karyakarta role on V1 user extra_roles.
        await db.users.update_one(
            {"id": existing["id"]},
            {"$addToSet": {"extra_roles": "karyakarta"},
             "$set": {"karyakarta_designation": designation}},
        )
        doc = Karyakarta(
            tenant_id=tid, person_id=pid or "", user_id=existing["id"],
            name=existing["name"] or name, mobile=mobile, designation=designation,
            ward_id=ward_id, village_id=village_id,
            dob=dob, anniversary=anniversary, notes=notes,
        ).model_dump()
        await db.karyakartas.insert_one(dict(doc))
        return {"linked": True, "karyakarta": doc, "user_id": existing["id"]}
    # Else pending karyakarta.
    doc = PendingKaryakarta(
        tenant_id=tid, name=name, mobile=mobile, designation=designation,
        ward_id=ward_id, village_id=village_id,
        dob=dob, anniversary=anniversary, notes=notes,
        imported_by=actor_id,
    ).model_dump()
    await db.pending_karyakartas.insert_one(dict(doc))
    return {"linked": False, "pending_karyakarta": doc}


@api.post("/karyakartas")
async def create_karyakarta(payload: KaryakartaCreate, user: dict = Depends(require_roles("pa", "admin"))):
    tid = get_tenant_id_for_write(user)
    return await _create_or_link_karyakarta(
        tid=tid, name=payload.name, mobile=payload.mobile,
        designation=payload.designation, actor_id=user["id"],
        ward_id=payload.ward_id, village_id=payload.village_id,
        dob=payload.dob, anniversary=payload.anniversary, notes=payload.notes,
    )


@api.post("/karyakartas/bulk-import")
async def bulk_import_karyakartas(rows: List[KaryakartaCreate], user: dict = Depends(require_roles("pa", "admin"))):
    """Bulk import (frontend parses CSV → posts as JSON array)."""
    tid = get_tenant_id_for_write(user)
    linked, pending = 0, 0
    errors: list[dict] = []
    for row in rows:
        try:
            r = await _create_or_link_karyakarta(
                tid=tid, name=row.name, mobile=row.mobile,
                designation=row.designation, actor_id=user["id"],
                ward_id=row.ward_id, village_id=row.village_id,
                dob=row.dob, anniversary=row.anniversary, notes=row.notes,
            )
            if r.get("linked"): linked += 1
            else: pending += 1
        except HTTPException as e:
            errors.append({"row": row.model_dump(), "error": e.detail})
        except Exception as e:
            errors.append({"row": row.model_dump(), "error": str(e)})
    return {"linked": linked, "pending": pending, "errors": errors, "total": len(rows)}


@api.delete("/karyakartas/{kid}")
async def delete_karyakarta(kid: str, user: dict = Depends(require_roles("pa", "admin"))):
    doc = await db.karyakartas.find_one(tenant_filter(user, {"id": kid}))
    if doc:
        await db.karyakartas.delete_one({"id": kid})
        # Remove karyakarta role from user + person
        if doc.get("user_id"):
            await db.users.update_one({"id": doc["user_id"]}, {"$pull": {"extra_roles": "karyakarta"}, "$set": {"karyakarta_designation": None}})
        if doc.get("person_id"):
            await db.persons.update_one({"id": doc["person_id"]}, {"$pull": {"types": "karyakarta"}})
        return {"ok": True}
    # try pending
    await db.pending_karyakartas.delete_one(tenant_filter(user, {"id": kid}))
    return {"ok": True}


# ============================================================================
# KARYAKARTA CELEBRATIONS (dashboard widget) — birthdays & anniversaries
# for karyakartas ONLY (not all citizens).
# ============================================================================
@api.get("/dashboard/karyakarta-celebrations")
async def karyakarta_celebrations(days: int = 7,
                                  user: dict = Depends(require_roles("pa", "politician", "admin"))):
    from datetime import date
    today = date.today()
    def _bucket(d_str: str) -> Optional[int]:
        if not d_str: return None
        try:
            dt = datetime.fromisoformat(d_str.split("T")[0]).date()
        except Exception:
            return None
        try:
            this_year = dt.replace(year=today.year)
        except ValueError:
            this_year = dt.replace(year=today.year, day=28)
        delta = (this_year - today).days
        if delta < 0:
            try:
                next_year = dt.replace(year=today.year + 1)
            except ValueError:
                next_year = dt.replace(year=today.year + 1, day=28)
            delta = (next_year - today).days
        return delta

    ks = await db.karyakartas.find(tenant_filter(user, {"is_active": True}), {"_id": 0}).to_list(5000)
    # Also pull dob/anniversary from the underlying V1 user rows if karyakarta row doesn't carry it.
    user_ids = [k["user_id"] for k in ks if k.get("user_id")]
    users_by_id = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "dob": 1, "marriage_anniversary": 1, "anniversary": 1, "name": 1, "profile_photo": 1}):
            users_by_id[u["id"]] = u

    bday_today, bday_soon, ann_today, ann_soon = [], [], [], []
    for k in ks:
        u = users_by_id.get(k.get("user_id") or "", {})
        dob = k.get("dob") or u.get("dob")
        ann = k.get("anniversary") or u.get("marriage_anniversary") or u.get("anniversary")
        info = {"id": k["id"], "name": k.get("name") or u.get("name"),
                "mobile": k.get("mobile"), "designation": k.get("designation"),
                "user_id": k.get("user_id"), "photo": u.get("profile_photo")}
        if dob:
            d = _bucket(dob)
            if d == 0: bday_today.append({**info, "dob": dob})
            elif d is not None and d <= days: bday_soon.append({**info, "dob": dob, "in_days": d})
        if ann:
            d = _bucket(ann)
            if d == 0: ann_today.append({**info, "anniversary": ann})
            elif d is not None and d <= days: ann_soon.append({**info, "anniversary": ann, "in_days": d})

    bday_soon.sort(key=lambda x: x["in_days"])
    ann_soon.sort(key=lambda x: x["in_days"])
    return {
        "birthdays": {"today": bday_today, "upcoming": bday_soon},
        "anniversaries": {"today": ann_today, "upcoming": ann_soon},
    }


# ============================================================================
# SUBSCRIPTION MANAGEMENT (Super Admin)
# ============================================================================
class SubscriptionUpdate(BaseModel):
    service_start_date: Optional[str] = None
    billing_cycle: Optional[Literal["monthly", "quarterly", "half_yearly", "yearly"]] = None
    agreed_amount: Optional[float] = None
    next_renewal_date: Optional[str] = None
    billing_notes: Optional[str] = None


@api.get("/admin/subscriptions")
async def list_subscriptions(user: dict = Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    rows = await db.portal_configs.find({}, {
        "_id": 0, "id": 1, "slug": 1, "constituency_name": 1, "politician_name": 1,
        "tenant_name": 1, "is_active": 1, "portal_status": 1,
        "service_start_date": 1, "billing_cycle": 1, "agreed_amount": 1,
        "next_renewal_date": 1, "billing_notes": 1, "created_at": 1,
    }).sort("created_at", -1).to_list(1000)
    return rows


@api.put("/admin/subscriptions/{portal_id}")
async def update_subscription(portal_id: str, payload: SubscriptionUpdate,
                              user: dict = Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    update["updated_at"] = now_iso()
    res = await db.portal_configs.update_one({"id": portal_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Portal not found")
    return await db.portal_configs.find_one({"id": portal_id}, {"_id": 0})


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
