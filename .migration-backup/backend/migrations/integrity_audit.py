"""Database Integrity Audit — reports every orphan/inconsistency.

Run:
    cd /app/backend && python migrations/integrity_audit.py

Read-only. Emits a JSON report. Pair with `integrity_cleanup.py` to fix
issues detected here.

Checks:
    O1  users referencing a tenant_id (portal_configs.id) that doesn't exist
    O2  households whose tenant_id has no portal_configs
    O3  memberships referencing a portal_configs.id that doesn't exist
    O4  memberships referencing a person_id that doesn't exist
    O5  memberships pointing to a user (_origin_user_id) that no longer exists
    O6  _v2_user_to_person mappings where the V1 user no longer exists
    O7  _v2_user_to_person mappings where the mapped Person no longer exists
    O8  Persons whose current_organisation_id has no portal_configs
    O9  Persons whose current_membership_id is stale (points nowhere)
    O10 credentials whose person_id has no Person
    O11 duplicate active mobile credentials for different Persons
    O12 duplicate citizen V1 users for same mobile+tenant_id (illegal)
    O13 operational rows (issues/visits/devworks/interactions/notifications)
        whose tenant_id has no portal_configs
    O14 operational rows whose person_id doesn't exist
    O15 operational rows whose origin_membership_id doesn't exist
    O16 person_timeline_events referencing a Person that no longer exists
    O17 person_audit / membership_audit referencing a Person that no longer exists
    O18 transfer_requests whose from/to org or person no longer exist
    O19 relationships whose person_a/person_b (V1 user_ids) no longer exist
    O20 relationships_v2 whose from/to person_id no longer exist
"""
from __future__ import annotations

import asyncio
import json
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


async def _ids(coll, projection=("id",)):
    proj = {p: 1 for p in projection}
    proj["_id"] = 0
    return {d["id"] async for d in coll.find({}, proj) if "id" in d}


async def run(db) -> dict:
    portal_ids = await _ids(db.portal_configs)
    user_ids = await _ids(db.users)
    person_ids = await _ids(db.persons)
    mem_ids = await _ids(db.memberships)

    checks: dict = {}

    async def scan(name, coll, filt, sample_size=10):
        rows = []
        async for d in coll.find(filt, {"_id": 0}):
            rows.append(d)
            if len(rows) >= sample_size:
                break
        total = await coll.count_documents(filt)
        checks[name] = {"count": total, "sample": rows}
        return total

    # ----- O1 users → portal_configs -----
    orphan_users = []
    async for u in db.users.find({"tenant_id": {"$ne": None}}, {"_id": 0, "id": 1, "mobile": 1, "tenant_id": 1, "role": 1}):
        if u.get("tenant_id") not in portal_ids:
            orphan_users.append(u)
    checks["O1_users_orphan_tenant"] = {"count": len(orphan_users), "sample": orphan_users[:10]}

    # ----- O2 households → portal_configs -----
    orphan_hh = []
    async for h in db.households.find({"tenant_id": {"$ne": None}}, {"_id": 0, "id": 1, "tenant_id": 1, "household_code": 1}):
        if h.get("tenant_id") not in portal_ids:
            orphan_hh.append(h)
    checks["O2_households_orphan_tenant"] = {"count": len(orphan_hh), "sample": orphan_hh[:10]}

    # ----- O3 memberships → portal_configs -----
    orphan_mem_org = []
    async for m in db.memberships.find({}, {"_id": 0, "id": 1, "person_id": 1, "organisation_id": 1, "status": 1}):
        if m.get("organisation_id") not in portal_ids:
            orphan_mem_org.append(m)
    checks["O3_memberships_orphan_organisation"] = {"count": len(orphan_mem_org), "sample": orphan_mem_org[:10]}

    # ----- O4 memberships → persons -----
    orphan_mem_person = []
    async for m in db.memberships.find({}, {"_id": 0, "id": 1, "person_id": 1, "status": 1}):
        if m.get("person_id") not in person_ids:
            orphan_mem_person.append(m)
    checks["O4_memberships_orphan_person"] = {"count": len(orphan_mem_person), "sample": orphan_mem_person[:10]}

    # ----- O5 memberships → V1 user -----
    orphan_mem_user = []
    async for m in db.memberships.find({"_origin_user_id": {"$ne": None}}, {"_id": 0, "id": 1, "_origin_user_id": 1, "status": 1}):
        if m.get("_origin_user_id") not in user_ids:
            orphan_mem_user.append(m)
    checks["O5_memberships_orphan_user"] = {"count": len(orphan_mem_user), "sample": orphan_mem_user[:10]}

    # ----- O6/O7 _v2_user_to_person map -----
    orphan_map_user, orphan_map_person = [], []
    async for row in db["_v2_user_to_person"].find({}, {"_id": 1, "person_id": 1}):
        uid = row["_id"]
        pid = row.get("person_id")
        if uid not in user_ids:
            orphan_map_user.append({"user_id": uid, "person_id": pid})
        if pid and pid not in person_ids:
            orphan_map_person.append({"user_id": uid, "person_id": pid})
    checks["O6_map_orphan_user"] = {"count": len(orphan_map_user), "sample": orphan_map_user[:10]}
    checks["O7_map_orphan_person"] = {"count": len(orphan_map_person), "sample": orphan_map_person[:10]}

    # ----- O8/O9 Person cache -----
    orphan_person_org, orphan_person_mem = [], []
    async for p in db.persons.find({}, {"_id": 0, "id": 1, "current_organisation_id": 1, "current_membership_id": 1, "types": 1}):
        if p.get("current_organisation_id") and p["current_organisation_id"] not in portal_ids:
            orphan_person_org.append(p)
        if p.get("current_membership_id") and p["current_membership_id"] not in mem_ids:
            orphan_person_mem.append(p)
    checks["O8_persons_orphan_org"] = {"count": len(orphan_person_org), "sample": orphan_person_org[:10]}
    checks["O9_persons_stale_membership"] = {"count": len(orphan_person_mem), "sample": orphan_person_mem[:10]}

    # ----- O10 credentials → persons -----
    orphan_creds = []
    async for c in db.credentials.find({}, {"_id": 0, "id": 1, "person_id": 1, "type": 1, "value": 1, "status": 1}):
        if c.get("person_id") not in person_ids:
            orphan_creds.append(c)
    checks["O10_credentials_orphan_person"] = {"count": len(orphan_creds), "sample": orphan_creds[:10]}

    # ----- O11 duplicate active mobile credentials -----
    dup_mobile = []
    pipeline = [
        {"$match": {"type": "mobile", "status": "active"}},
        {"$group": {"_id": "$value", "n": {"$sum": 1}, "persons": {"$addToSet": "$person_id"}}},
        {"$match": {"n": {"$gt": 1}}},
        {"$limit": 50},
    ]
    async for r in db.credentials.aggregate(pipeline):
        dup_mobile.append({"mobile": r["_id"], "count": r["n"], "persons": r["persons"]})
    checks["O11_duplicate_active_mobile"] = {"count": len(dup_mobile), "sample": dup_mobile[:10]}

    # ----- O12 duplicate citizens (mobile+tenant) -----
    dup_v1 = []
    pipeline2 = [
        {"$match": {"role": "citizen", "is_active": {"$ne": False}}},
        {"$group": {"_id": {"m": "$mobile", "t": "$tenant_id"}, "n": {"$sum": 1}, "ids": {"$addToSet": "$id"}}},
        {"$match": {"n": {"$gt": 1}}},
    ]
    async for r in db.users.aggregate(pipeline2):
        dup_v1.append({"mobile": r["_id"]["m"], "tenant_id": r["_id"]["t"], "count": r["n"], "ids": r["ids"]})
    checks["O12_duplicate_citizens"] = {"count": len(dup_v1), "sample": dup_v1[:10]}

    # ----- O13/O14/O15 operational rows -----
    for col in ("issues", "visits", "devworks", "interactions", "notifications"):
        bad_org, bad_person, bad_mem = 0, 0, 0
        async for r in db[col].find({}, {"_id": 0, "id": 1, "tenant_id": 1, "person_id": 1, "origin_membership_id": 1}):
            if r.get("tenant_id") and r["tenant_id"] not in portal_ids: bad_org += 1
            if r.get("person_id") and r["person_id"] not in person_ids: bad_person += 1
            if r.get("origin_membership_id") and r["origin_membership_id"] not in mem_ids: bad_mem += 1
        checks[f"O13_{col}_orphan_tenant"] = {"count": bad_org}
        checks[f"O14_{col}_orphan_person"] = {"count": bad_person}
        checks[f"O15_{col}_orphan_membership"] = {"count": bad_mem}

    # ----- O16 timeline events -----
    await scan("O16_timeline_orphan_person", db.person_timeline_events, {"person_id": {"$nin": list(person_ids)}})
    # ----- O17 audits -----
    await scan("O17_person_audit_orphan", db.person_audit, {"person_id": {"$nin": list(person_ids)}})
    await scan("O17_membership_audit_orphan", db.membership_audit, {"person_id": {"$nin": list(person_ids)}})

    # ----- O18 transfer_requests -----
    bad_tr = []
    async for t in db.transfer_requests.find({}, {"_id": 0}):
        problems = []
        if t.get("person_id") not in person_ids: problems.append("person_missing")
        if t.get("from_organisation_id") not in portal_ids: problems.append("from_org_missing")
        if t.get("to_organisation_id") not in portal_ids: problems.append("to_org_missing")
        if t.get("from_membership_id") not in mem_ids: problems.append("from_mem_missing")
        if problems:
            bad_tr.append({"id": t.get("id"), "problems": problems, "status": t.get("status")})
    checks["O18_transfer_requests_broken"] = {"count": len(bad_tr), "sample": bad_tr[:10]}

    # ----- O19/O20 relationships -----
    bad_rel_v1 = []
    async for r in db.relationships.find({}, {"_id": 0, "id": 1, "person_a": 1, "person_b": 1}):
        if r["person_a"] not in user_ids or r["person_b"] not in user_ids:
            bad_rel_v1.append(r)
    checks["O19_relationships_orphan"] = {"count": len(bad_rel_v1), "sample": bad_rel_v1[:10]}
    bad_rel_v2 = []
    async for r in db.relationships_v2.find({}, {"_id": 0, "id": 1, "from_person_id": 1, "to_person_id": 1, "status": 1}):
        if r["from_person_id"] not in person_ids or r["to_person_id"] not in person_ids:
            bad_rel_v2.append(r)
    checks["O20_relationships_v2_orphan"] = {"count": len(bad_rel_v2), "sample": bad_rel_v2[:10]}

    total_issues = sum(v.get("count", 0) for v in checks.values())
    return {
        "computed_at_db": DB_NAME,
        "counts": {
            "portal_configs": len(portal_ids),
            "users": len(user_ids),
            "persons": len(person_ids),
            "memberships": len(mem_ids),
        },
        "total_orphan_records": total_issues,
        "checks": checks,
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    report = await run(db)
    print(json.dumps(report, indent=2, default=str))
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
