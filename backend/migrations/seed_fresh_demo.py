"""Fresh Demo Seed — creates ONE clean demo constituency with fully consistent
relationships (portal → households → citizens → memberships → issues → devworks
→ visits → notifications). Every relationship is guaranteed valid; a follow-up
`integrity_audit.py` will report zero orphans.

Run:
    cd /app/backend && python migrations/seed_fresh_demo.py

Idempotent: safe to re-run; existing "demo-fresh-*" rows are updated in place.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

# Allow running as a script (`python migrations/seed_fresh_demo.py`) — the
# migrations/ dir sits alongside backend modules but isn't on sys.path.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

import v2_dualwrite as v2dw

load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TAG = "demo-fresh"           # marker on every seeded row
PORTAL_SLUG = "demo-office"
POLITICIAN_NAME = "Hon. Demo MLA"
CONSTITUENCY_NAME = "Demo Constituency"
TENANT_NAME = "Demo Constituency Office"

CITIZENS = [
    {"name": "Aarav Sharma", "mobile": "9000000001", "gender": "Male", "role": "Head", "hh": 1},
    {"name": "Priya Sharma", "mobile": "9000000002", "gender": "Female", "role": "Spouse", "hh": 1},
    {"name": "Rohan Sharma", "mobile": "9000000003", "gender": "Male", "role": "Son", "hh": 1},
    {"name": "Vikram Desai", "mobile": "9000000004", "gender": "Male", "role": "Head", "hh": 2},
    {"name": "Meera Desai", "mobile": "9000000005", "gender": "Female", "role": "Spouse", "hh": 2},
    {"name": "Karan Iyer", "mobile": "9000000006", "gender": "Male", "role": "Head", "hh": 3},
    {"name": "Anita Iyer", "mobile": "9000000007", "gender": "Female", "role": "Spouse", "hh": 3},
    {"name": "Sneha Nair", "mobile": "9000000008", "gender": "Female", "role": "Head", "hh": 4},
]


def _now(): return datetime.now(timezone.utc).isoformat()


async def seed(db):
    print("=== Fresh Demo Seed ===")

    # ---- 1. Portal ----
    tid = "tenant_" + TAG
    portal = {
        "id": tid, "slug": PORTAL_SLUG,
        "politician_name": POLITICIAN_NAME,
        "constituency_name": CONSTITUENCY_NAME,
        "tenant_name": TENANT_NAME,
        "theme_color": "#0A1128",
        "is_active": True, "portal_status": "active",
        "created_at": _now(), "updated_at": _now(),
        "_demo_tag": TAG,
    }
    await db.portal_configs.update_one({"id": tid}, {"$set": portal}, upsert=True)
    print(f"portal: {tid}")

    # ---- 2. Areas (2 wards) ----
    ward_ids = []
    for name in ["Ward A", "Ward B"]:
        wid = f"ward_{TAG}_{name.split()[1].lower()}"
        await db.areas.update_one(
            {"id": wid},
            {"$set": {"id": wid, "tenant_id": tid, "kind": "ward",
                      "name": name, "code": name.replace(" ", "-").upper(),
                      "_demo_tag": TAG, "created_at": _now()}},
            upsert=True,
        )
        ward_ids.append(wid)

    # ---- 3. Households ----
    hh_ids: dict[int, str] = {}
    for n in {c["hh"] for c in CITIZENS}:
        hid = f"hh_{TAG}_{n}"
        head = next(c for c in CITIZENS if c["hh"] == n and c["role"] == "Head")
        await db.households.update_one(
            {"id": hid},
            {"$set": {"id": hid, "tenant_id": tid,
                      "household_code": f"H-{10000 + n}",
                      "family_head_name": head["name"],
                      "address": f"Demo House {n}, Demo Street",
                      "house_number": f"D-{100 + n}",
                      "region_type": "urban",
                      "ward_id": ward_ids[(n - 1) % 2],
                      "members_count": sum(1 for c in CITIZENS if c["hh"] == n),
                      "created_at": _now(), "_demo_tag": TAG}},
            upsert=True,
        )
        hh_ids[n] = hid

    # ---- 4. Staff (admin, PA, worker, politician) ----
    def hash_pw(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
    staff_defs = [
        ("admin@demo-office.jansetu.in", "Demo Admin", "admin", "demo123"),
        ("pa@demo-office.jansetu.in", "Demo PA", "pa", "demo123"),
        ("worker@demo-office.jansetu.in", "Demo Worker", "worker", "demo123"),
        ("mla@demo-office.jansetu.in", POLITICIAN_NAME, "politician", "demo123"),
    ]
    staff_ids: dict[str, str] = {}
    for email, name, role, pw in staff_defs:
        uid = f"u_{TAG}_{role}"
        doc = {
            "id": uid, "role": role, "name": name,
            "tenant_id": tid, "email": email, "password_hash": hash_pw(pw),
            "must_change_password": False, "is_active": True,
            "created_at": _now(), "_demo_tag": TAG,
        }
        await db.users.update_one({"id": uid}, {"$set": doc}, upsert=True)
        staff_ids[role] = uid
        await v2dw.ensure_person_for_user(db, doc)

    # ---- 5. Citizens ----
    citizen_ids: dict[str, str] = {}
    for c in CITIZENS:
        uid = f"u_{TAG}_c_{c['mobile'][-4:]}"
        doc = {
            "id": uid, "role": "citizen", "name": c["name"],
            "tenant_id": tid, "mobile": c["mobile"], "gender": c["gender"],
            "household_id": hh_ids[c["hh"]],
            "ward_id": ward_ids[(c["hh"] - 1) % 2],
            "region_type": "urban",
            "house_number": f"D-{100 + c['hh']}",
            "address": f"Demo House {c['hh']}, Demo Street",
            "is_active": True, "status": "alive",
            "created_at": _now(), "_demo_tag": TAG,
        }
        await db.users.update_one({"id": uid}, {"$set": doc}, upsert=True)
        citizen_ids[c["mobile"]] = uid
        await v2dw.ensure_person_for_user(db, doc)
        # Stamp person_id back on V1 row.
        pid_row = await db["_v2_user_to_person"].find_one({"_id": uid})
        if pid_row:
            mem = await db.memberships.find_one(
                {"person_id": pid_row["person_id"], "organisation_id": tid, "status": "active"})
            await db.users.update_one(
                {"id": uid},
                {"$set": {"person_id": pid_row["person_id"],
                          "origin_membership_id": mem["id"] if mem else None}},
            )

    # ---- 6. Family relationships (V1 + V2) ----
    # Household 1: Aarav (head) → Priya (spouse), Rohan (son)
    def _mkrel(a_mobile, b_mobile, rel_type):
        rid = f"rel_{TAG}_{a_mobile}_{b_mobile}"
        return {
            "id": rid, "tenant_id": tid,
            "person_a": citizen_ids[a_mobile],
            "person_b": citizen_ids[b_mobile],
            "type": rel_type, "created_at": _now(), "_demo_tag": TAG,
        }
    rels = [
        _mkrel("9000000001", "9000000002", "Spouse"),
        _mkrel("9000000001", "9000000003", "Father"),
        _mkrel("9000000004", "9000000005", "Spouse"),
        _mkrel("9000000006", "9000000007", "Spouse"),
    ]
    for r in rels:
        await db.relationships.update_one({"id": r["id"]}, {"$set": r}, upsert=True)
        await v2dw.sync_relationship_to_v2(
            db, rel=r,
            actor_user={"id": staff_ids["pa"], "tenant_id": tid, "role": "pa"})

    # ---- 7. Issues + timeline ----
    for i, sample in enumerate([
        {"cat": "Road", "title": "Pothole near main road", "status": "Resolved", "mobile": "9000000001"},
        {"cat": "Water", "title": "Water supply disruption", "status": "In Progress", "mobile": "9000000004"},
        {"cat": "Electricity", "title": "Streetlight outage", "status": "Assigned", "mobile": "9000000006"},
        {"cat": "Sanitation", "title": "Garbage pickup delay", "status": "New", "mobile": "9000000002"},
    ]):
        iid = f"iss_{TAG}_{i}"
        uid = citizen_ids[sample["mobile"]]
        u = await db.users.find_one({"id": uid})
        doc = {
            "id": iid, "tenant_id": tid, "citizen_id": uid,
            "issue_code": f"ISS-DEMO-{100 + i}",
            "title": sample["title"], "description": "Auto-seeded demo issue",
            "category": sample["cat"], "status": sample["status"],
            "assigned_to": staff_ids["worker"] if sample["status"] != "New" else None,
            "assigned_to_name": "Demo Worker" if sample["status"] != "New" else None,
            "created_at": _now(),
            "person_id": u.get("person_id"),
            "origin_membership_id": u.get("origin_membership_id"),
            "_demo_tag": TAG,
        }
        await db.issues.update_one({"id": iid}, {"$set": doc}, upsert=True)
        await v2dw.sync_issue_to_v2(db, doc, citizen_user=u)

    # ---- 8. DevWorks ----
    for i, w in enumerate([
        {"title": "Ward A road resurfacing", "status": "Completed"},
        {"title": "New drainage in Ward B", "status": "In Progress"},
    ]):
        did = f"dw_{TAG}_{i}"
        actor = await db.users.find_one({"id": staff_ids["pa"]})
        doc = {
            "id": did, "tenant_id": tid, "title": w["title"],
            "description": "Auto-seeded demo devwork",
            "category": "Road" if i == 0 else "Water",
            "status": w["status"], "location": "Demo Constituency",
            "created_by": staff_ids["pa"], "created_at": _now(), "_demo_tag": TAG,
        }
        await db.devworks.update_one({"id": did}, {"$set": doc}, upsert=True)
        await v2dw.sync_devwork_to_v2(db, devwork=doc, actor_user=actor)

    # ---- 9. Visit ----
    vid = f"visit_{TAG}_1"
    actor = await db.users.find_one({"id": staff_ids["pa"]})
    visit_doc = {
        "id": vid, "tenant_id": tid, "title": "MLA Public Meeting",
        "visit_type": "Public Meeting",
        "date": (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat(),
        "time": "10:00", "location": "Demo Community Hall",
        "status": "Published",
        "created_by": staff_ids["pa"], "created_at": _now(),
        "ward_ids": ward_ids, "village_ids": [], "_demo_tag": TAG,
    }
    await db.visits.update_one({"id": vid}, {"$set": visit_doc}, upsert=True)
    await v2dw.sync_visit_to_v2(db, visit=visit_doc, actor_user=actor)

    # ---- 10. Notification ----
    nid = f"notif_{TAG}_1"
    notif_doc = {
        "id": nid, "tenant_id": tid, "title": "Welcome to Demo Portal",
        "body": "Explore the demo constituency data.",
        "notif_type": "Important Announcement",
        "scope": "all", "ward_ids": [], "village_ids": [],
        "created_by": staff_ids["pa"], "created_by_name": "Demo PA",
        "recipients_count": len(CITIZENS),
        "created_at": _now(), "_demo_tag": TAG,
    }
    await db.notifications.update_one({"id": nid}, {"$set": notif_doc}, upsert=True)
    await v2dw.sync_notification_to_v2(db, notification=notif_doc, actor_user=actor)

    print("\n=== Demo Credentials ===")
    for email, _, role, pw in staff_defs:
        print(f"  {role:10s} {email:40s}  password: {pw}")
    print(f"  {'citizen':10s} mobile 9000000001..9000000008  OTP: 123456")
    print(f"\nPortal: /citizen/login?portal={PORTAL_SLUG}")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await seed(db)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
