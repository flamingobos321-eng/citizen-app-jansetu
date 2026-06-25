"""M2 backfill engine — integration tests against a live Mongo (uses a unique
test DB so we can wipe between runs without touching dev data).

Run:
    cd /app/backend && python -m pytest tests/test_m2_backfill.py -v
"""
from __future__ import annotations

import asyncio
import csv
import os
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from migrations.m2_backfill import Backfill, Rollback, load_dedupe_decisions

load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]


def _now(offset_minutes: int = 0) -> str:
    from datetime import datetime, timedelta, timezone
    return (datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)).isoformat()


@pytest_asyncio.fixture
async def db():
    test_db_name = f"jansetu_m2_test_{uuid.uuid4().hex[:8]}"
    client = AsyncIOMotorClient(MONGO_URL)
    database = client[test_db_name]
    # Index creation mirrors server.py's _ensure_v2_indexes minimally for the
    # invariants the tests rely on.
    await database.credentials.create_index(
        [("type", 1), ("value", 1)], unique=True,
        partialFilterExpression={"status": "active"},
        name="cred_type_value_active_unique",
    )
    yield database
    await client.drop_database(test_db_name)
    client.close()


async def _seed_users(db, *users: dict):
    if users:
        await db.users.insert_many(list(users))


def _citizen(**overrides) -> dict:
    base = {
        "id": "u_" + uuid.uuid4().hex[:8],
        "role": "citizen",
        "name": "Test Citizen",
        "mobile": "9000000001",
        "tenant_id": "tenant-A",
        "household_id": "h-1",
        "ward_id": "w-1",
        "village_id": "v-1",
        "address": "Plot 1",
        "email": None,
        "created_at": _now(),
    }
    base.update(overrides)
    return base


# ============================================================================
#                              SCENARIOS
# ============================================================================

@pytest.mark.asyncio
async def test_clean_migration_dry_run_writes_nothing(db):
    await _seed_users(db, _citizen(name="Alice", mobile="9000000001"))
    bf = Backfill(db, dry_run=True, dedupe={})
    result = await bf.run()
    assert result["ok"]
    assert result["counts"]["citizens_scanned"] == 1
    # Dry-run must not have written anything
    assert await db.persons.count_documents({}) == 0
    assert await db.credentials.count_documents({}) == 0
    assert await db.memberships.count_documents({}) == 0


@pytest.mark.asyncio
async def test_clean_migration_commit_creates_one_of_each(db):
    u = _citizen(name="Alice", mobile="9000000001", email="alice@x.com")
    await _seed_users(db, u)
    result = await Backfill(db, dry_run=False, dedupe={}).run()
    assert result["ok"], result
    assert await db.persons.count_documents({}) == 1
    # mobile + email = 2 credentials
    assert await db.credentials.count_documents({}) == 2
    assert await db.memberships.count_documents({"status": "active"}) == 1
    # mapping recorded
    mp = await db["_v2_user_to_person"].find_one({"_id": u["id"]})
    assert mp and mp["person_id"].startswith("p_")
    # consent rows auto-granted
    assert await db.person_consents.count_documents({"scope": "tier1"}) == 1
    assert await db.person_consents.count_documents({"scope": "tier2"}) == 1


@pytest.mark.asyncio
async def test_idempotent_rerun_does_not_duplicate(db):
    await _seed_users(db, _citizen(mobile="9000000001"))
    await Backfill(db, dry_run=False, dedupe={}).run()
    p1 = await db.persons.count_documents({})
    c1 = await db.credentials.count_documents({})
    m1 = await db.memberships.count_documents({})
    # Re-run
    r2 = await Backfill(db, dry_run=False, dedupe={}).run()
    assert r2["ok"]
    assert await db.persons.count_documents({}) == p1
    assert await db.credentials.count_documents({}) == c1
    assert await db.memberships.count_documents({}) == m1


@pytest.mark.asyncio
async def test_duplicate_mobile_without_decision_aborts(db):
    await _seed_users(db,
        _citizen(name="Alice", mobile="9000000001", tenant_id="A"),
        _citizen(name="Bob",   mobile="9000000001", tenant_id="B"),
    )
    result = await Backfill(db, dry_run=False, dedupe={}).run()
    assert not result["ok"]
    assert result["rolled_back"]
    # Nothing should remain after auto-rollback
    assert await db.persons.count_documents({}) == 0
    assert await db.memberships.count_documents({}) == 0


@pytest.mark.asyncio
async def test_duplicate_mobile_decision_MERGE(db):
    await _seed_users(db,
        _citizen(name="Rahul Shinde", mobile="9000000001", tenant_id="A", created_at=_now(-60)),
        _citizen(name="Rahul Shinde", mobile="9000000001", tenant_id="B", created_at=_now(0)),
    )
    dedupe = {"9000000001": {"decision": "MERGE", "user_ids": []}}
    result = await Backfill(db, dry_run=False, dedupe=dedupe).run()
    assert result["ok"], result
    # 1 person, 1 active mobile credential, 2 memberships (1 active, 1 archived)
    assert await db.persons.count_documents({}) == 1
    assert await db.credentials.count_documents({"type": "mobile", "status": "active"}) == 1
    assert await db.memberships.count_documents({"status": "active"}) == 1
    assert await db.memberships.count_documents({"status": "archived"}) == 1
    archived = await db.memberships.find_one({"status": "archived"})
    assert archived["transfer_reason"] == "migration"
    assert archived["end_date"] is not None


@pytest.mark.asyncio
async def test_duplicate_mobile_decision_KEEP_SEPARATE(db):
    await _seed_users(db,
        _citizen(name="Person A", mobile="9000000001", tenant_id="A", created_at=_now(-60)),
        _citizen(name="Person B", mobile="9000000001", tenant_id="B", created_at=_now(0)),
    )
    dedupe = {"9000000001": {"decision": "KEEP_SEPARATE", "user_ids": []}}
    result = await Backfill(db, dry_run=False, dedupe=dedupe).run()
    assert result["ok"], result
    # 2 persons, 1 active mobile credential (newest) + 1 revoked mobile credential (older)
    assert await db.persons.count_documents({}) == 2
    assert await db.credentials.count_documents({"type": "mobile", "status": "active"}) == 1
    assert await db.credentials.count_documents({"type": "mobile", "status": "revoked"}) == 1
    # 2 memberships, both active (one per person)
    assert await db.memberships.count_documents({"status": "active"}) == 2


@pytest.mark.asyncio
async def test_cross_tenant_citizens_get_separate_persons(db):
    await _seed_users(db,
        _citizen(name="A", mobile="9000000001", tenant_id="tenant-A"),
        _citizen(name="B", mobile="9000000002", tenant_id="tenant-B"),
    )
    result = await Backfill(db, dry_run=False, dedupe={}).run()
    assert result["ok"]
    assert await db.persons.count_documents({}) == 2
    assert await db.memberships.count_documents({"organisation_id": "tenant-A"}) == 1
    assert await db.memberships.count_documents({"organisation_id": "tenant-B"}) == 1


@pytest.mark.asyncio
async def test_issue_person_id_stamped(db):
    u = _citizen(mobile="9000000001")
    await _seed_users(db, u)
    await db.issues.insert_one({
        "id": "iss-1", "tenant_id": u["tenant_id"], "citizen_id": u["id"],
        "issue_code": "ISS-1", "title": "X", "description": "Y", "category": "Water",
        "status": "New", "created_at": _now(),
    })
    result = await Backfill(db, dry_run=False, dedupe={}).run()
    assert result["ok"], result
    issue = await db.issues.find_one({"id": "iss-1"})
    assert issue["person_id"] is not None
    mp = await db["_v2_user_to_person"].find_one({"_id": u["id"]})
    assert issue["person_id"] == mp["person_id"]


@pytest.mark.asyncio
async def test_interaction_legacy_person_id_rewritten(db):
    u = _citizen(mobile="9000000001")
    await _seed_users(db, u)
    await db.interactions.insert_one({
        "id": "int-1", "tenant_id": u["tenant_id"], "person_id": u["id"],
        "interaction_type": "Medical", "description": "X",
        "occurred_at": _now(), "created_at": _now(),
    })
    await Backfill(db, dry_run=False, dedupe={}).run()
    it = await db.interactions.find_one({"id": "int-1"})
    # V2 person_id is now the new p_… id; the legacy is preserved separately
    assert it["person_id"].startswith("p_")
    assert it["_v1_legacy_person_id"] == u["id"]


@pytest.mark.asyncio
async def test_relationship_migrated_to_v2(db):
    u1 = _citizen(name="Father", mobile="9000000001", tenant_id="A")
    u2 = _citizen(name="Son",    mobile="9000000002", tenant_id="A")
    await _seed_users(db, u1, u2)
    await db.relationships.insert_one({
        "id": "rel-1", "tenant_id": "A",
        "person_a": u1["id"], "person_b": u2["id"], "type": "father", "since": "1990-01-01",
        "created_at": _now(),
    })
    result = await Backfill(db, dry_run=False, dedupe={}).run()
    assert result["ok"], result
    new_rel = await db.relationships_v2.find_one({})
    assert new_rel
    assert new_rel["type"] == "father"
    p_a = await db["_v2_user_to_person"].find_one({"_id": u1["id"]})
    p_b = await db["_v2_user_to_person"].find_one({"_id": u2["id"]})
    assert new_rel["from_person_id"] == p_a["person_id"]
    assert new_rel["to_person_id"] == p_b["person_id"]
    assert "tenant_id" not in new_rel  # global, no tenant scope
    # Re-run: must not duplicate
    await Backfill(db, dry_run=False, dedupe={}).run()
    assert await db.relationships_v2.count_documents({}) == 1


@pytest.mark.asyncio
async def test_household_membership_preserved(db):
    u = _citizen(mobile="9000000001", household_id="hh-1", ward_id="w-7", village_id="v-2",
                 address="Plot 22, MG Road", state="MH", district="Pune", taluka="Haveli")
    await _seed_users(db, u)
    await Backfill(db, dry_run=False, dedupe={}).run()
    m = await db.memberships.find_one({"_origin_user_id": u["id"]})
    assert m["household_id"] == "hh-1"
    assert m["ward_id"] == "w-7"
    assert m["village_id"] == "v-2"
    assert m["address"] == "Plot 22, MG Road"
    assert m["state"] == "MH"
    assert m["district"] == "Pune"
    assert m["taluka"] == "Haveli"


@pytest.mark.asyncio
async def test_rollback_restores_v1_state(db):
    u = _citizen(mobile="9000000001")
    await _seed_users(db, u)
    await db.issues.insert_one({
        "id": "iss-1", "tenant_id": u["tenant_id"], "citizen_id": u["id"],
        "issue_code": "ISS-1", "title": "X", "description": "Y", "category": "Water",
        "status": "New", "created_at": _now(),
    })
    result = await Backfill(db, dry_run=False, dedupe={}).run()
    assert result["ok"]
    run_id = result["run_id"]
    # Rollback
    rb = await Rollback(db, run_id).execute()
    assert rb["deleted"]["persons"] >= 1
    assert await db.persons.count_documents({}) == 0
    assert await db.credentials.count_documents({}) == 0
    assert await db.memberships.count_documents({}) == 0
    assert await db.person_audit.count_documents({}) == 0
    assert await db["_v2_user_to_person"].count_documents({}) == 0
    # operational rows un-stamped
    issue = await db.issues.find_one({"id": "iss-1"})
    assert issue["person_id"] is None


@pytest.mark.asyncio
async def test_validation_catches_unmapped_issue(db):
    # Issue references a citizen_id that doesn't exist → must surface as error.
    await db.issues.insert_one({
        "id": "iss-orphan", "tenant_id": "A", "citizen_id": "ghost",
        "issue_code": "ISS-9", "title": "x", "description": "y", "category": "Water",
        "status": "New", "created_at": _now(),
    })
    result = await Backfill(db, dry_run=False, dedupe={}).run()
    # ok=True because there were no citizens to migrate; but errors should mention the orphan.
    assert any("citizen_id=ghost" in e for e in result["errors"])


@pytest.mark.asyncio
async def test_dedupe_csv_with_blank_decision_raises(tmp_path: Path):
    csv_path = tmp_path / "d.csv"
    csv_path.write_text(
        "mobile,row_index,classification,user_id,tenant_slug,name,dob,email,gender,household_id,created_at,decision\n"
        "9000000001,0,REVIEW_NAME,u1,A,Alice,,,Female,h1,2025-01-01,\n"
        "9000000001,1,REVIEW_NAME,u2,B,Bob,,,Male,h2,2025-02-01,\n"
    )
    with pytest.raises(ValueError, match="incomplete"):
        load_dedupe_decisions(csv_path)


@pytest.mark.asyncio
async def test_dedupe_csv_with_filled_decision_parses(tmp_path: Path):
    csv_path = tmp_path / "d.csv"
    csv_path.write_text(
        "mobile,row_index,classification,user_id,tenant_slug,name,dob,email,gender,household_id,created_at,decision\n"
        "9000000001,0,AUTO_MERGE,u1,A,Alice,,,Female,h1,2025-01-01,MERGE\n"
        "9000000001,1,AUTO_MERGE,u2,B,Alice,,,Female,h2,2025-02-01,MERGE\n"
        "9000000002,0,REVIEW_NAME,u3,A,Charlie,,,Male,h3,2025-01-01,KEEP_SEPARATE\n"
        "9000000002,1,REVIEW_NAME,u4,B,Dora,,,Female,h4,2025-02-01,KEEP_SEPARATE\n"
    )
    decisions = load_dedupe_decisions(csv_path)
    assert decisions["9000000001"]["decision"] == "MERGE"
    assert decisions["9000000002"]["decision"] == "KEEP_SEPARATE"
