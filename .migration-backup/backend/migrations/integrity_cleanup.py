"""Database Integrity Cleanup — safely removes orphaned records.

Run:
    cd /app/backend && python migrations/integrity_cleanup.py --dry-run
    cd /app/backend && python migrations/integrity_cleanup.py --apply

The --dry-run mode PRINTS what would be removed without touching the DB.
The --apply mode performs the removals. Each removal step is idempotent.

Cleanup order (deepest first to avoid re-orphaning):
    1. Orphaned map rows (_v2_user_to_person → user gone)
    2. Orphaned credentials (person gone)
    3. Orphaned timeline events / audit rows (person gone)
    4. Orphaned relationships_v2 (either person gone)
    5. Orphaned relationships V1 (either V1 user gone)
    6. Orphaned memberships (person gone)
    7. Orphaned operational rows (tenant gone)
    8. Persons cache fix: null current_organisation_id / current_membership_id
       when they point to nothing.
    9. transfer_requests with any broken FK → marked status='cancelled'
       (never deleted — they are audit records).
    10. Users whose tenant_id is missing → marked is_active=False + tagged
        _cleanup_reason (never deleted — preserves audit).
"""
from __future__ import annotations

import argparse
import asyncio
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def _now(): return datetime.now(timezone.utc).isoformat()


async def _existing_ids(coll):
    return {d["id"] async for d in coll.find({}, {"id": 1, "_id": 0}) if "id" in d}


async def cleanup(db, *, apply: bool) -> dict:
    portal_ids = await _existing_ids(db.portal_configs)
    user_ids = await _existing_ids(db.users)
    person_ids = await _existing_ids(db.persons)
    mem_ids = await _existing_ids(db.memberships)
    report: dict[str, int] = {}

    async def _delete_many(coll, filt, key):
        n = await coll.count_documents(filt)
        if n and apply:
            await coll.delete_many(filt)
        report[key] = n

    # 1) orphan map rows
    orphan_map = [row["_id"] async for row in db["_v2_user_to_person"].find({}, {"_id": 1})
                  if row["_id"] not in user_ids]
    report["map_rows_removed"] = len(orphan_map)
    if apply and orphan_map:
        await db["_v2_user_to_person"].delete_many({"_id": {"$in": orphan_map}})

    # 2) orphan credentials
    await _delete_many(db.credentials, {"person_id": {"$nin": list(person_ids)}}, "credentials_removed")

    # 3) orphan timeline + audit rows
    await _delete_many(db.person_timeline_events, {"person_id": {"$nin": list(person_ids)}}, "timeline_removed")
    await _delete_many(db.person_audit, {"person_id": {"$nin": list(person_ids)}}, "person_audit_removed")
    await _delete_many(db.membership_audit, {"person_id": {"$nin": list(person_ids)}}, "membership_audit_removed")

    # 4) orphan relationships_v2
    await _delete_many(
        db.relationships_v2,
        {"$or": [{"from_person_id": {"$nin": list(person_ids)}},
                 {"to_person_id": {"$nin": list(person_ids)}}]},
        "relationships_v2_removed",
    )
    # 5) orphan relationships V1
    await _delete_many(
        db.relationships,
        {"$or": [{"person_a": {"$nin": list(user_ids)}},
                 {"person_b": {"$nin": list(user_ids)}}]},
        "relationships_v1_removed",
    )

    # 6) orphan memberships (person or tenant gone)
    await _delete_many(
        db.memberships,
        {"$or": [
            {"person_id": {"$nin": list(person_ids)}},
            {"organisation_id": {"$nin": list(portal_ids)}},
        ]},
        "memberships_removed",
    )

    # 7) orphan operational rows (tenant gone)
    for col in ("issues", "visits", "devworks", "interactions", "notifications", "households"):
        await _delete_many(db[col], {"tenant_id": {"$nin": list(portal_ids)}}, f"{col}_removed")

    # 8) fix Person cache (rebuild id sets after step 6)
    mem_ids_now = await _existing_ids(db.memberships)
    fixed_org, fixed_mem = 0, 0
    async for p in db.persons.find({}, {"_id": 0, "id": 1, "current_organisation_id": 1, "current_membership_id": 1}):
        updates = {}
        if p.get("current_organisation_id") and p["current_organisation_id"] not in portal_ids:
            updates["current_organisation_id"] = None
            fixed_org += 1
        if p.get("current_membership_id") and p["current_membership_id"] not in mem_ids_now:
            updates["current_membership_id"] = None
            fixed_mem += 1
        if updates and apply:
            updates["updated_at"] = _now()
            await db.persons.update_one({"id": p["id"]}, {"$set": updates})
    report["person_cache_org_reset"] = fixed_org
    report["person_cache_membership_reset"] = fixed_mem

    # 9) transfer_requests with broken FK → cancelled (never deleted)
    portal_ids_list = list(portal_ids)
    person_ids_list = list(person_ids)
    tr_filter = {
        "status": {"$in": ["otp_pending"]},
        "$or": [
            {"person_id": {"$nin": person_ids_list}},
            {"from_organisation_id": {"$nin": portal_ids_list}},
            {"to_organisation_id": {"$nin": portal_ids_list}},
        ],
    }
    tr_broken = await db.transfer_requests.count_documents(tr_filter)
    if tr_broken and apply:
        await db.transfer_requests.update_many(
            tr_filter,
            {"$set": {"status": "cancelled", "_cleanup_reason": "orphan_fk", "cancelled_at": _now()}},
        )
    report["transfer_requests_cancelled"] = tr_broken

    # 10) users with missing tenant → deactivate (audit preserved)
    bad_user_filter = {
        "tenant_id": {"$nin": portal_ids_list, "$ne": None},
        "is_active": {"$ne": False},
    }
    bad_users = await db.users.count_documents(bad_user_filter)
    if bad_users and apply:
        await db.users.update_many(
            bad_user_filter,
            {"$set": {"is_active": False, "_cleanup_reason": "orphan_tenant",
                      "_cleanup_at": _now()}},
        )
    report["users_deactivated"] = bad_users

    return report


async def main():
    parser = argparse.ArgumentParser()
    grp = parser.add_mutually_exclusive_group(required=True)
    grp.add_argument("--dry-run", action="store_true")
    grp.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    report = await cleanup(db, apply=args.apply)
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"=== Integrity cleanup — {mode} ===")
    for k, v in report.items():
        marker = "✓" if v == 0 else "→"
        print(f"  {marker} {k}: {v}")
    print(f"Total actions: {sum(report.values())}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
