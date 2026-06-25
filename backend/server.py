"""JANSETU - Constituency Management Platform API."""
import os
import io
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from models import (
    CitizenOTPRequest, CitizenOTPVerify, StaffLogin,
    CitizenRegister, StaffCreate, User,
    Constituency, Area, AreaCreate, Household,
    Issue, IssueCreate, IssueAssign, IssueUpdateStatus, IssueFeedback,
    Visit, VisitCreate, Notification, NotificationCreate,
    DevWork, DevWorkCreate,
    Relationship, RelationshipCreate, RELATION_TYPES, inverse_relation,
    PortalConfig, PortalConfigCreate,
    ServiceInteraction, ServiceInteractionCreate,
    ISSUE_CATEGORIES, ISSUE_STATUSES, DEV_STATUSES, VISIT_STATUSES,
    now_iso, new_id,
)
from storage_util import put_object, get_object, init_storage, APP_NAME

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

    Raises 403 for super_admin attempting to read tenant data (they should only
    access tenant-management endpoints, never per-tenant collections).
    NOTE: This helper is defined now (Phase 1) but will be applied to all
    endpoints in Phase 2. Currently unused until cutover.
    """
    if user.get("role") == "super_admin":
        raise HTTPException(403, "Super admin cannot access tenant data directly")
    tid = user.get("tenant_id")
    if not tid:
        raise HTTPException(403, "User has no tenant")
    q = dict(extra_q or {})
    q["tenant_id"] = tid
    return q


async def can_access_file(user: dict, path: str) -> bool:
    """Permission check for /api/files/{path}.

    - Staff (worker/pa/politician/admin): all files.
    - Citizen: own profile photo, photos on their own issues, photos on approved (public) dev works.
    - Worker: additionally, photos on issues assigned to them.
    """
    role = user.get("role")
    if role in ("pa", "politician", "admin"):
        return True
    # Own profile photo (any role)
    if await db.users.find_one({"id": user["id"], "profile_photo": path}, {"id": 1}):
        return True
    # Approved dev work photos are public to all logged-in users
    if await db.devworks.find_one({"photos": path, "approved": True}, {"id": 1}):
        return True
    # Issue photos — owning citizen or assigned worker
    issue = await db.issues.find_one(
        {"$or": [{"photos": path}, {"completion_photos": path}]},
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


# ----------------- Health -----------------
@api.get("/")
async def root():
    return {"name": "JANSETU API", "status": "ok"}


@api.get("/meta/categories")
async def meta_cats():
    return {"issue_categories": ISSUE_CATEGORIES, "issue_statuses": ISSUE_STATUSES, "dev_statuses": DEV_STATUSES, "visit_statuses": VISIT_STATUSES}


# ----------------- AUTH -----------------
@api.post("/auth/citizen/request-otp")
async def request_otp(payload: CitizenOTPRequest):
    # Mock OTP — store last issued mobile (any 6 digits will work)
    await db.otps.update_one(
        {"mobile": payload.mobile},
        {"$set": {"mobile": payload.mobile, "otp": "123456", "at": now_iso()}},
        upsert=True,
    )
    return {"sent": True, "demo_otp": "123456"}


@api.post("/auth/citizen/verify-otp")
async def verify_otp(payload: CitizenOTPVerify):
    if payload.otp != "123456" and len(payload.otp) != 6:
        raise HTTPException(400, "Invalid OTP")
    user = await db.users.find_one({"mobile": payload.mobile, "role": "citizen"}, {"_id": 0, "password_hash": 0})
    if not user:
        # Return a flag to register
        return {"new_user": True, "mobile": payload.mobile}
    token = create_token(user["id"], "citizen", user.get("tenant_id"))
    return {"token": token, "user": user, "new_user": False}


@api.post("/auth/citizen/register")
async def citizen_register(payload: CitizenRegister):
    if await db.users.find_one({"mobile": payload.mobile, "role": "citizen"}):
        raise HTTPException(400, "Mobile already registered")

    # Try to link to an existing household at same address (urban) — match by house_number + ward/village
    existing_hh = None
    if payload.house_number:
        hh_query = {"house_number": payload.house_number}
        if payload.ward_id:
            hh_query["ward_id"] = payload.ward_id
        if payload.village_id:
            hh_query["village_id"] = payload.village_id
        existing_hh = await db.households.find_one(hh_query)

    if existing_hh:
        await db.households.update_one({"id": existing_hh["id"]}, {"$inc": {"members_count": 1}})
        hh_id = existing_hh["id"]
    else:
        hh_seq = await next_seq("household")
        hh_code = f"H-{10000 + hh_seq}"
        hh = Household(
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
    final_hh = await db.households.find_one({"id": hh_id}, {"_id": 0})
    token = create_token(user.id, "citizen", user.tenant_id)
    return {"token": token, "user": user.model_dump(exclude={"password_hash"}), "household": final_hh}


@api.post("/auth/staff/login")
async def staff_login(payload: StaffLogin):
    user = await db.users.find_one({"email": payload.email, "role": {"$ne": "citizen"}})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_token(user["id"], user["role"], user.get("tenant_id"))
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ----------------- USERS / STAFF -----------------
@api.post("/admin/staff")
async def create_staff(payload: StaffCreate, _: dict = Depends(require_roles("admin"))):
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(400, "Email exists")
    u = User(
        role=payload.role,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        designation=payload.designation,
        mobile=payload.mobile,
    )
    await db.users.insert_one(u.model_dump())
    out = u.model_dump()
    out.pop("password_hash", None)
    return out


@api.get("/users")
async def list_users(role: Optional[str] = None, user: dict = Depends(get_current_user)):
    # Staff-only directory. Citizens never need a full user listing.
    if not is_staff(user):
        raise HTTPException(403, "Forbidden")
    q = {}
    if role:
        q["role"] = role
    docs = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return docs


# ----------------- AREAS -----------------
@api.get("/constituencies")
async def list_constituencies():
    return await db.constituencies.find({}, {"_id": 0}).to_list(100)


@api.get("/areas")
async def list_areas(kind: Optional[str] = None, region_type: Optional[str] = None):
    q = {}
    if kind:
        q["kind"] = kind
    if region_type:
        q["region_type"] = region_type
    return await db.areas.find(q, {"_id": 0}).sort("name", 1).to_list(2000)


@api.post("/areas")
async def create_area(payload: AreaCreate, _: dict = Depends(require_roles("admin"))):
    a = Area(**payload.model_dump())
    await db.areas.insert_one(a.model_dump())
    return a.model_dump()


@api.delete("/areas/{area_id}")
async def delete_area(area_id: str, _: dict = Depends(require_roles("admin"))):
    await db.areas.delete_one({"id": area_id})
    return {"ok": True}


# ----------------- HOUSEHOLDS -----------------
@api.get("/households")
async def list_households(search: Optional[str] = None, user: dict = Depends(get_current_user)):
    # Staff-only listing. Citizens look up their own via /households/{id} with their household_id.
    if not is_staff(user):
        raise HTTPException(403, "Forbidden")
    q = {}
    if search:
        # also match member mobile/name
        member_q = {"$or": [{"mobile": {"$regex": search, "$options": "i"}}, {"name": {"$regex": search, "$options": "i"}}]}
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
    # Staff can view any household; a citizen can only view their own household.
    if not is_staff(user) and user.get("household_id") != hh_id:
        raise HTTPException(403, "Forbidden")
    hh = await db.households.find_one({"id": hh_id}, {"_id": 0})
    if not hh:
        raise HTTPException(404, "Not found")
    members = await db.users.find({"household_id": hh_id}, {"_id": 0, "password_hash": 0}).to_list(100)
    issues = await db.issues.find({"household_id": hh_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Development benefits = approved dev works in same ward/village
    bq = {"approved": True}
    or_clauses = []
    if hh.get("ward_id"):
        or_clauses.append({"ward_id": hh["ward_id"]})
    if hh.get("village_id"):
        or_clauses.append({"village_id": hh["village_id"]})
    if or_clauses:
        bq["$or"] = or_clauses
    benefits = await db.devworks.find(bq, {"_id": 0}).sort("created_at", -1).to_list(100) if or_clauses else []
    total = await db.issues.count_documents({"household_id": hh_id})
    resolved = await db.issues.count_documents({"household_id": hh_id, "status": {"$in": ["Resolved", "Verified"]}})
    pending = total - resolved
    return {"household": hh, "members": members, "issues": issues, "benefits": benefits, "stats": {"total": total, "resolved": resolved, "pending": pending}}


# ----------------- ISSUES -----------------
@api.post("/issues")
async def create_issue(payload: IssueCreate, user: dict = Depends(get_current_user)):
    seq = await next_seq("issue")
    code = f"ISS-{10000 + seq}"
    issue = Issue(
        issue_code=code,
        citizen_id=user["id"],
        household_id=user.get("household_id"),
        category=payload.category,
        title=payload.title,
        description=payload.description,
        photos=payload.photos,
        gps_lat=payload.gps_lat,
        gps_lng=payload.gps_lng,
        ward_id=user.get("ward_id"),
        village_id=user.get("village_id"),
        timeline=[{"status": "New", "at": now_iso(), "by": user["name"], "note": "Issue raised"}],
    )
    await db.issues.insert_one(issue.model_dump())
    return issue.model_dump()


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
    q = {}
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
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(404, "Not found")
    # Access policy: staff (pa/politician/admin) — all; assigned worker — yes;
    # owning citizen — yes; everyone else — 403.
    role = user.get("role")
    allowed = (
        role in ("pa", "politician", "admin")
        or (role == "worker" and user["id"] == issue.get("assigned_to"))
        or user["id"] == issue.get("citizen_id")
    )
    if not allowed:
        raise HTTPException(403, "Forbidden")
    citizen = await db.users.find_one({"id": issue["citizen_id"]}, {"_id": 0, "password_hash": 0})
    return {"issue": issue, "citizen": citizen}


@api.post("/issues/{issue_id}/assign")
async def assign_issue(issue_id: str, payload: IssueAssign, user: dict = Depends(require_roles("pa", "admin"))):
    worker = await db.users.find_one({"id": payload.assigned_to}, {"_id": 0})
    if not worker:
        raise HTTPException(404, "Worker not found")
    update = {
        "assigned_to": payload.assigned_to,
        "assigned_to_name": worker["name"],
        "due_date": payload.due_date,
        "remarks": payload.remarks,
        "status": "Assigned",
        "updated_at": now_iso(),
    }
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$set": update,
            "$push": {"timeline": {"status": "Assigned", "at": now_iso(), "by": user["name"], "note": f"Assigned to {worker['name']}"}},
        },
    )
    return await db.issues.find_one({"id": issue_id}, {"_id": 0})


@api.post("/issues/{issue_id}/status")
async def update_status(issue_id: str, payload: IssueUpdateStatus, user: dict = Depends(require_roles("worker", "pa", "admin"))):
    if payload.status not in ISSUE_STATUSES:
        raise HTTPException(400, "Invalid status")
    # workers can only update issues assigned to them
    if user["role"] == "worker":
        issue = await db.issues.find_one({"id": issue_id})
        if not issue or issue.get("assigned_to") != user["id"]:
            raise HTTPException(403, "Not your assignment")
    update = {"status": payload.status, "updated_at": now_iso()}
    if payload.completion_notes:
        update["completion_notes"] = payload.completion_notes
    if payload.completion_photos:
        update["completion_photos"] = payload.completion_photos
    if payload.remarks:
        update["remarks"] = payload.remarks
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$set": update,
            "$push": {"timeline": {"status": payload.status, "at": now_iso(), "by": user["name"], "note": payload.remarks or payload.completion_notes or ""}},
        },
    )
    return await db.issues.find_one({"id": issue_id}, {"_id": 0})


@api.post("/issues/{issue_id}/feedback")
async def feedback(issue_id: str, payload: IssueFeedback, user: dict = Depends(get_current_user)):
    issue = await db.issues.find_one({"id": issue_id})
    if not issue or issue["citizen_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    update = {
        "rating": payload.rating,
        "feedback_comment": payload.comment,
        "status": "Verified" if payload.verified else "Reopened",
        "updated_at": now_iso(),
    }
    note = f"Citizen rated {payload.rating}/5" + (f" — {payload.comment}" if payload.comment else "")
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$set": update,
            "$push": {"timeline": {"status": update["status"], "at": now_iso(), "by": user["name"], "note": note}},
        },
    )
    return await db.issues.find_one({"id": issue_id}, {"_id": 0})


# ----------------- VISITS -----------------
@api.post("/visits")
async def create_visit(payload: VisitCreate, user: dict = Depends(require_roles("pa", "admin"))):
    # PA creates as Pending Approval; admin auto-publishes
    v = Visit(**payload.model_dump(), created_by=user["id"])
    if user["role"] == "admin":
        v.status = "Published"
        v.approved_by = user["id"]
        v.approved_at = now_iso()
    else:
        v.status = "Pending Approval"
    await db.visits.insert_one(v.model_dump())
    if v.status == "Published":
        await _publish_visit_notification(v, user)
    return v.model_dump()


async def _publish_visit_notification(v: Visit, user: dict):
    recipients = await _count_recipients("wards" if v.ward_ids else ("villages" if v.village_ids else "all"), v.ward_ids, v.village_ids)
    notif = Notification(
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


@api.post("/visits/{visit_id}/approve")
async def approve_visit(visit_id: str, user: dict = Depends(require_roles("politician", "admin"))):
    v = await db.visits.find_one({"id": visit_id})
    if not v:
        raise HTTPException(404, "Not found")
    if v.get("status") == "Published":
        return {**{k: v[k] for k in v if k != "_id"}}
    await db.visits.update_one({"id": visit_id}, {"$set": {"status": "Published", "approved_by": user["id"], "approved_at": now_iso()}})
    visit = Visit(**{**v, "status": "Published", "approved_by": user["id"], "approved_at": now_iso()})
    await _publish_visit_notification(visit, user)
    return await db.visits.find_one({"id": visit_id}, {"_id": 0})


@api.get("/visits")
async def list_visits(upcoming: bool = False, user: dict = Depends(get_current_user)):
    q = {}
    if upcoming:
        q["date"] = {"$gte": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    if user["role"] == "citizen":
        q["status"] = "Published"
    return await db.visits.find(q, {"_id": 0}).sort("date", 1).limit(200).to_list(200)


async def _count_recipients(scope: str, ward_ids: list, village_ids: list) -> int:
    q = {"role": "citizen"}
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
    recipients = await _count_recipients(payload.scope, payload.ward_ids, payload.village_ids)
    n = Notification(**payload.model_dump(), created_by=user["id"], created_by_name=user["name"], recipients_count=recipients)
    await db.notifications.insert_one(n.model_dump())
    return n.model_dump()


@api.get("/notifications")
async def list_notifs(user: dict = Depends(get_current_user)):
    # filter for citizen by scope
    q = {}
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
    d = DevWork(**payload.model_dump(), created_by=user["id"])
    if user["role"] == "admin":
        d.approved = True
        d.approved_by = user["id"]
        d.approved_at = now_iso()
    await db.devworks.insert_one(d.model_dump())
    return d.model_dump()


@api.post("/devworks/{dev_id}/approve")
async def approve_dev(dev_id: str, user: dict = Depends(require_roles("politician", "admin"))):
    await db.devworks.update_one({"id": dev_id}, {"$set": {"approved": True, "approved_by": user["id"], "approved_at": now_iso()}})
    return await db.devworks.find_one({"id": dev_id}, {"_id": 0})


@api.delete("/devworks/{dev_id}")
async def delete_dev(dev_id: str, _: dict = Depends(require_roles("admin"))):
    await db.devworks.delete_one({"id": dev_id})
    return {"ok": True}


@api.post("/devworks/{dev_id}/progress")
async def add_dev_progress(dev_id: str, note: str = Query(...), user: dict = Depends(require_roles("pa", "admin"))):
    entry = {"at": now_iso(), "by": user["name"], "note": note}
    await db.devworks.update_one({"id": dev_id}, {"$push": {"progress_updates": entry}, "$set": {"updated_at": now_iso()}})
    return await db.devworks.find_one({"id": dev_id}, {"_id": 0})


@api.get("/devworks")
async def list_devs(status: Optional[str] = None, ward_id: Optional[str] = None, village_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
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
    await db.devworks.update_one({"id": dev_id}, {"$set": {"status": status, "updated_at": now_iso()}})
    return await db.devworks.find_one({"id": dev_id}, {"_id": 0})


# ----------------- WORKER actions -----------------
@api.post("/issues/{issue_id}/request-reassign")
async def request_reassign(issue_id: str, reason: str = Query(""), user: dict = Depends(require_roles("worker"))):
    issue = await db.issues.find_one({"id": issue_id})
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
        {"id": issue_id},
        {
            "$set": {"status": "Reassignment Requested", "updated_at": now_iso(), "reassignment_request": reassignment},
            "$push": {"timeline": {"status": "Reassignment Requested", "at": now_iso(), "by": user["name"], "note": reason or "Worker requested reassignment"}},
        },
    )
    return {"ok": True}


@api.post("/issues/{issue_id}/approve-reassign")
async def approve_reassign(issue_id: str, new_worker_id: str = Query(...), user: dict = Depends(require_roles("pa", "admin"))):
    worker = await db.users.find_one({"id": new_worker_id, "role": "worker"})
    if not worker:
        raise HTTPException(404, "Worker not found")
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(404, "Issue not found")
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$set": {
                "assigned_to": worker["id"],
                "assigned_to_name": worker["name"],
                "status": "Assigned",
                "updated_at": now_iso(),
                "reassignment_request": None,
            },
            "$push": {"timeline": {"status": "Reassignment Approved", "at": now_iso(), "by": user["name"], "note": f"Reassigned to {worker['name']}"}},
        },
    )
    return await db.issues.find_one({"id": issue_id}, {"_id": 0})


@api.post("/issues/{issue_id}/reject-reassign")
async def reject_reassign(issue_id: str, note: str = Query(""), user: dict = Depends(require_roles("pa", "admin"))):
    issue = await db.issues.find_one({"id": issue_id})
    if not issue:
        raise HTTPException(404, "Issue not found")
    # revert to In Progress (issue stays with the original worker)
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$set": {"status": "In Progress", "updated_at": now_iso(), "reassignment_request": None},
            "$push": {"timeline": {"status": "Reassignment Rejected", "at": now_iso(), "by": user["name"], "note": note or "Continue with original worker"}},
        },
    )
    return await db.issues.find_one({"id": issue_id}, {"_id": 0})


# ----------------- DASHBOARD -----------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    total_citizens = await db.users.count_documents({"role": "citizen"})
    total_households = await db.households.count_documents({})
    total_issues = await db.issues.count_documents({})
    resolved = await db.issues.count_documents({"status": {"$in": ["Resolved", "Verified"]}})
    pending = await db.issues.count_documents({"status": {"$in": ["New", "Under Review", "Assigned", "In Progress", "Reopened"]}})
    total_workers = await db.users.count_documents({"role": "worker"})
    total_visits = await db.visits.count_documents({})
    total_devworks = await db.devworks.count_documents({})

    # category breakdown
    cat_pipeline = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    cats = [{"category": c["_id"], "count": c["count"]} async for c in db.issues.aggregate(cat_pipeline)]

    # status breakdown
    status_pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    statuses = [{"status": s["_id"], "count": s["count"]} async for s in db.issues.aggregate(status_pipeline)]

    # ward performance
    ward_pipeline = [{"$group": {"_id": "$ward_id", "total": {"$sum": 1}, "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["Resolved", "Verified"]]}, 1, 0]}}}}]
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
    total = await db.issues.count_documents({"citizen_id": user["id"]})
    resolved = await db.issues.count_documents({"citizen_id": user["id"], "status": {"$in": ["Resolved", "Verified"]}})
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


# ----------------- REPORTS -----------------
@api.get("/reports/issues.csv")
async def report_csv(user: dict = Depends(require_roles("pa", "politician", "admin"))):
    issues = await db.issues.find({}, {"_id": 0}).to_list(5000)
    cols = ["issue_code", "category", "title", "status", "assigned_to_name", "rating", "created_at"]
    lines = [",".join(cols)]
    for i in issues:
        vals = []
        for c in cols:
            v = i.get(c, "")
            v = "" if v is None else str(v).replace(",", " ").replace("\n", " ")
            vals.append(v)
        lines.append(",".join(vals))
    return Response("\n".join(lines), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=issues.csv"})



# ----------------- PERSON MASTER / FAMILY GRAPH / SERVICE HISTORY (long-term vision foundation) -----------------
@api.get("/meta/relation-types")
async def relation_types():
    return {"relation_types": RELATION_TYPES}


@api.get("/persons/{person_id}")
async def person_profile(person_id: str, user: dict = Depends(get_current_user)):
    # Citizens may only view their own person profile; staff may view any.
    if not is_staff(user) and user["id"] != person_id:
        raise HTTPException(403, "Forbidden")
    person = await db.users.find_one({"id": person_id}, {"_id": 0, "password_hash": 0})
    if not person:
        raise HTTPException(404, "Person not found")
    rels = await db.relationships.find({"$or": [{"person_a": person_id}, {"person_b": person_id}]}, {"_id": 0}).to_list(500)
    other_ids = [r["person_b"] if r["person_a"] == person_id else r["person_a"] for r in rels]
    others = {u["id"]: u async for u in db.users.find({"id": {"$in": other_ids}}, {"_id": 0, "password_hash": 0})}
    for r in rels:
        is_a = r["person_a"] == person_id
        other_id = r["person_b"] if is_a else r["person_a"]
        other = others.get(other_id)
        r["other"] = other
        # display_type = how the OTHER person relates TO the viewer.
        # Stored: person_a is `type` of person_b.
        # If viewer is person_b → other (person_a) has relation `type` to me → display_type = type.
        # If viewer is person_a → other (person_b) has the inverse of `type` to me;
        #   the inverse label depends on the OTHER person's gender (not the viewer's).
        if not is_a:
            r["display_type"] = r["type"]
        else:
            r["display_type"] = inverse_relation(r["type"], (other or {}).get("gender"))
    interactions = await db.interactions.find({"person_id": person_id}, {"_id": 0}).sort("occurred_at", -1).to_list(500)
    issues = await db.issues.find({"citizen_id": person_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"person": person, "relationships": rels, "interactions": interactions, "issues": issues}


@api.put("/persons/{person_id}")
async def update_person(person_id: str, payload: dict, _: dict = Depends(require_roles("pa", "politician", "admin"))):
    allowed = {"anniversary", "occupation", "profile_photo", "notes", "status", "date_of_death",
               "supporter_since", "political_role", "influence_level", "political_notes", "family_lineage"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(400, "No allowed fields")
    await db.users.update_one({"id": person_id}, {"$set": update})
    return await db.users.find_one({"id": person_id}, {"_id": 0, "password_hash": 0})


@api.post("/relationships")
async def create_relationship(payload: RelationshipCreate, _: dict = Depends(require_roles("pa", "admin"))):
    if payload.type not in RELATION_TYPES:
        raise HTTPException(400, "Invalid relation type")
    if payload.person_a == payload.person_b:
        raise HTTPException(400, "Cannot create a relationship with the same person")
    if not await db.users.find_one({"id": payload.person_a}) or not await db.users.find_one({"id": payload.person_b}):
        raise HTTPException(404, "Person not found")
    # Prevent exact duplicate edge (same direction + same type)
    existing = await db.relationships.find_one({
        "person_a": payload.person_a,
        "person_b": payload.person_b,
        "type": payload.type,
    })
    if existing:
        raise HTTPException(409, "This relationship already exists")
    r = Relationship(**payload.model_dump())
    await db.relationships.insert_one(r.model_dump())
    return r.model_dump()


@api.delete("/relationships/{rel_id}")
async def delete_relationship(rel_id: str, _: dict = Depends(require_roles("pa", "admin"))):
    await db.relationships.delete_one({"id": rel_id})
    return {"ok": True}


@api.post("/interactions")
async def create_interaction(payload: ServiceInteractionCreate, user: dict = Depends(require_roles("worker", "pa", "admin"))):
    data = payload.model_dump()
    if not data.get("occurred_at"):
        data["occurred_at"] = now_iso()
    if data.get("worker_id"):
        w = await db.users.find_one({"id": data["worker_id"]})
        if w:
            data["worker_name"] = w["name"]
    elif user["role"] == "worker":
        data["worker_id"] = user["id"]
        data["worker_name"] = user["name"]
    interaction = ServiceInteraction(**data)
    await db.interactions.insert_one(interaction.model_dump())
    return interaction.model_dump()


@api.get("/dashboard/celebrations")
async def celebrations(days: int = 7, _: dict = Depends(require_roles("pa", "politician", "admin"))):
    from datetime import date
    today = date.today()
    citizens_alive = await db.users.find({"role": "citizen", "status": {"$ne": "deceased"}}, {"_id": 0, "password_hash": 0}).to_list(5000)
    citizens_dead = await db.users.find({"role": "citizen", "status": "deceased"}, {"_id": 0, "password_hash": 0}).to_list(5000)

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
async def list_portals_admin(_: dict = Depends(require_roles("admin"))):
    return await db.portal_configs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/portals")
async def create_portal(payload: PortalConfigCreate, _: dict = Depends(require_roles("admin"))):
    slug = _normalize_slug(payload.slug)
    if not slug:
        raise HTTPException(400, "Invalid slug")
    if await db.portal_configs.find_one({"slug": slug}):
        raise HTTPException(409, "Slug already exists")
    data = payload.model_dump()
    data["slug"] = slug
    cfg = PortalConfig(**data)
    if cfg.is_default:
        # ensure only one default
        await db.portal_configs.update_many({}, {"$set": {"is_default": False}})
    await db.portal_configs.insert_one(cfg.model_dump())
    return cfg.model_dump()


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


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
