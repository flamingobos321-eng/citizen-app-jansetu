"""M3 dual-write helper tests — exercise v2_dualwrite against a fresh Mongo db.

These tests are unit-level: they exercise the helpers directly to ensure each
V1 write correctly mirrors into V2 and that re-running is idempotent. End-to-end
HTTP-layer assertions are covered by the backend testing agent's regression run.

Run:
    cd /app/backend && python -m pytest tests/test_m3_dualwrite.py -v
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import v2_dualwrite as v2dw

load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]


def _now():
    return datetime.now(timezone.utc).isoformat()


@pytest_asyncio.fixture
async def db():
    test_db_name = f"jansetu_m3_test_{uuid.uuid4().hex[:8]}"
    client = AsyncIOMotorClient(MONGO_URL)
    database = client[test_db_name]
    await database.credentials.create_index(
        [("type", 1), ("value", 1)], unique=True,
        partialFilterExpression={"status": "active"},
        name="cred_type_value_active_unique",
    )
    yield database
    await client.drop_database(test_db_name)
    client.close()


def _user(role="citizen", **over):
    base = {
        "id": "u_" + uuid.uuid4().hex[:8],
        "role": role,
        "name": "Test",
        "mobile": f"9000{uuid.uuid4().int % 1000000:06d}",
        "email": None,
        "gender": "m",
        "tenant_id": "tenant-A",
        "household_id": "h-1",
        "ward_id": "w-1",
        "village_id": None,
        "address": "Plot 1",
        "created_at": _now(),
    }
    base.update(over)
    return base


# ============================================================================
# ensure_person_for_user
# ============================================================================
@pytest.mark.asyncio
async def test_ensure_person_for_citizen_creates_everything(db):
    u = _user(name="Alice", mobile="9100000001", email="alice@x.com")
    await db.users.insert_one(u)
    pid = await v2dw.ensure_person_for_user(db, u)
    assert pid and pid.startswith("p_")
    # Person + map exist
    assert await db.persons.count_documents({"id": pid}) == 1
    mp = await db["_v2_user_to_person"].find_one({"_id": u["id"]})
    assert mp["person_id"] == pid
    # Credentials (mobile + email)
    assert await db.credentials.count_documents(
        {"person_id": pid, "type": "mobile", "status": "active"}) == 1
    assert await db.credentials.count_documents(
        {"person_id": pid, "type": "email", "status": "active"}) == 1
    # Membership = exactly 1 active, scope=constituency
    mems = await db.memberships.find({"person_id": pid}).to_list(10)
    assert len(mems) == 1
    assert mems[0]["status"] == "active"
    assert mems[0]["scope_type"] == "constituency"
    assert mems[0]["organisation_id"] == "tenant-A"
    # Person cache updated
    p = await db.persons.find_one({"id": pid})
    assert p["current_organisation_id"] == "tenant-A"
    assert p["current_membership_id"] == mems[0]["id"]
    # Consents + timeline events
    assert await db.person_consents.count_documents(
        {"person_id": pid, "scope": "tier1"}) == 1
    assert await db.person_consents.count_documents(
        {"person_id": pid, "scope": "tier2"}) == 1
    tl_types = [e["event_type"] async for e in
                db.person_timeline_events.find({"person_id": pid})]
    assert "registered" in tl_types
    assert "membership_created" in tl_types


@pytest.mark.asyncio
async def test_ensure_person_idempotent(db):
    u = _user(mobile="9100000002")
    pid1 = await v2dw.ensure_person_for_user(db, u)
    pid2 = await v2dw.ensure_person_for_user(db, u)
    assert pid1 == pid2
    assert await db.persons.count_documents({}) == 1
    assert await db.memberships.count_documents({}) == 1
    assert await db.credentials.count_documents(
        {"type": "mobile", "status": "active"}) == 1


@pytest.mark.asyncio
async def test_ensure_person_for_staff_uses_staff_scope(db):
    u = _user(role="admin", email="admin@tenant-a.in", mobile=None)
    pid = await v2dw.ensure_person_for_user(db, u)
    assert pid
    mem = await db.memberships.find_one({"person_id": pid})
    assert mem and mem["scope_type"] == "staff"
    # Per spec: current_organisation_id must remain null for staff Persons.
    p = await db.persons.find_one({"id": pid})
    assert p["current_organisation_id"] is None
    assert p["current_membership_id"] is None
    # No tier1/tier2 auto consents for staff
    assert await db.person_consents.count_documents({"person_id": pid}) == 0
    # No "registered" timeline event for staff
    tl_types = [e["event_type"] async for e in
                db.person_timeline_events.find({"person_id": pid})]
    assert "registered" not in tl_types


# ============================================================================
# Issues
# ============================================================================
@pytest.mark.asyncio
async def test_sync_issue_stamps_person_and_membership(db):
    u = _user(mobile="9100000010")
    await db.users.insert_one(u)
    pid = await v2dw.ensure_person_for_user(db, u)
    issue = {
        "id": "iss-1", "tenant_id": u["tenant_id"], "citizen_id": u["id"],
        "issue_code": "ISS-1", "title": "Pothole", "description": "Big",
        "category": "Road", "status": "New", "created_at": _now(),
    }
    await db.issues.insert_one(issue)
    await v2dw.sync_issue_to_v2(db, issue, citizen_user=u)
    stamped = await db.issues.find_one({"id": "iss-1"})
    assert stamped["person_id"] == pid
    assert stamped["origin_membership_id"]
    # Timeline event
    ev = await db.person_timeline_events.find_one(
        {"event_type": "complaint_raised", "person_id": pid})
    assert ev and ev["ref_id"] == "iss-1"


@pytest.mark.asyncio
async def test_sync_issue_event_emits_timeline(db):
    u = _user(mobile="9100000011")
    await db.users.insert_one(u)
    pid = await v2dw.ensure_person_for_user(db, u)
    issue = {
        "id": "iss-2", "tenant_id": u["tenant_id"], "citizen_id": u["id"],
        "person_id": pid, "issue_code": "ISS-2", "status": "New",
        "title": "X", "created_at": _now(),
    }
    await db.issues.insert_one(issue)
    await v2dw.sync_issue_event(db, issue_id="iss-2", event_label="Assigned",
                                note="to W", actor_user=u)
    await v2dw.sync_issue_event(db, issue_id="iss-2", event_label="Resolved",
                                note="done", actor_user=u)
    types = [e["event_type"] async for e in
             db.person_timeline_events.find({"person_id": pid})]
    assert "complaint_assigned" in types
    assert "complaint_resolved" in types


# ============================================================================
# Visits / Notifications / DevWorks (staff-owned)
# ============================================================================
@pytest.mark.asyncio
async def test_visit_stamping_uses_staff_membership(db):
    staff = _user(role="admin", email="admin@a.in", mobile=None)
    await db.users.insert_one(staff)
    await v2dw.ensure_person_for_user(db, staff)
    visit = {
        "id": "v-1", "tenant_id": staff["tenant_id"],
        "title": "Town Hall", "date": "2026-07-01", "time": "10:00",
        "location": "Hall", "visit_type": "Meeting", "created_by": staff["id"],
        "created_at": _now(), "status": "Pending Approval",
        "ward_ids": [], "village_ids": [],
    }
    await db.visits.insert_one(visit)
    await v2dw.sync_visit_to_v2(db, visit=visit, actor_user=staff)
    v = await db.visits.find_one({"id": "v-1"})
    assert v["person_id"] and v["origin_membership_id"]
    mem = await db.memberships.find_one({"id": v["origin_membership_id"]})
    assert mem["scope_type"] == "staff"


@pytest.mark.asyncio
async def test_notification_and_devwork_stamping(db):
    staff = _user(role="pa", email="pa@a.in", mobile=None)
    await db.users.insert_one(staff)
    await v2dw.ensure_person_for_user(db, staff)
    notif = {"id": "n-1", "tenant_id": staff["tenant_id"], "title": "X",
             "body": "y", "notif_type": "Scheme", "scope": "all",
             "ward_ids": [], "village_ids": [], "created_by": staff["id"],
             "recipients_count": 0, "created_at": _now()}
    await db.notifications.insert_one(notif)
    await v2dw.sync_notification_to_v2(db, notification=notif, actor_user=staff)
    devw = {"id": "d-1", "tenant_id": staff["tenant_id"], "title": "Road",
            "description": "z", "category": "Road", "location": "L",
            "status": "Planned", "created_by": staff["id"], "created_at": _now()}
    await db.devworks.insert_one(devw)
    await v2dw.sync_devwork_to_v2(db, devwork=devw, actor_user=staff)
    n_stamped = await db.notifications.find_one({"id": "n-1"})
    d_stamped = await db.devworks.find_one({"id": "d-1"})
    assert n_stamped["person_id"] and n_stamped["origin_membership_id"]
    assert d_stamped["person_id"] and d_stamped["origin_membership_id"]


# ============================================================================
# Interactions
# ============================================================================
@pytest.mark.asyncio
async def test_interaction_attaches_to_subject_person(db):
    citizen = _user(name="Subject", mobile="9100000020")
    staff = _user(role="worker", email="w@a.in", mobile=None,
                  id="u_staff_" + uuid.uuid4().hex[:6])
    await db.users.insert_one(citizen)
    await db.users.insert_one(staff)
    cpid = await v2dw.ensure_person_for_user(db, citizen)
    await v2dw.ensure_person_for_user(db, staff)
    inter = {
        "id": "int-1", "tenant_id": citizen["tenant_id"],
        "person_id": citizen["id"],  # V1 stored user_id
        "interaction_type": "Scheme Help", "description": "Helped",
        "occurred_at": _now(), "created_at": _now(),
    }
    await db.interactions.insert_one(inter)
    await v2dw.sync_interaction_to_v2(
        db, interaction=inter, subject_user=citizen, actor_user=staff)
    stamped = await db.interactions.find_one({"id": "int-1"})
    assert stamped["person_id"] == cpid
    assert stamped["origin_membership_id"]


# ============================================================================
# Relationships
# ============================================================================
@pytest.mark.asyncio
async def test_relationship_mirror_to_v2(db):
    a = _user(name="Father", mobile="9100000030")
    b = _user(name="Son", mobile="9100000031")
    staff = _user(role="pa", email="pa2@a.in", mobile=None,
                  id="u_staff_" + uuid.uuid4().hex[:6])
    await db.users.insert_many([a, b, staff])
    pa = await v2dw.ensure_person_for_user(db, a)
    pb = await v2dw.ensure_person_for_user(db, b)
    await v2dw.ensure_person_for_user(db, staff)
    rel = {"id": "r-1", "tenant_id": a["tenant_id"],
           "person_a": a["id"], "person_b": b["id"],
           "type": "Father", "created_at": _now()}
    await db.relationships.insert_one(rel)
    await v2dw.sync_relationship_to_v2(db, rel=rel, actor_user=staff)
    v2 = await db.relationships_v2.find_one({"_v1_relationship_id": "r-1"})
    assert v2["from_person_id"] == pa and v2["to_person_id"] == pb
    assert v2["status"] == "active"
    await v2dw.revoke_relationship_v2(db, rel_id="r-1", actor_user=staff)
    v2 = await db.relationships_v2.find_one({"_v1_relationship_id": "r-1"})
    assert v2["status"] == "ended"


# ============================================================================
# Profile / Household updates
# ============================================================================
@pytest.mark.asyncio
async def test_profile_update_mirrors_to_person(db):
    u = _user(name="Old", mobile="9100000040")
    await db.users.insert_one(u)
    pid = await v2dw.ensure_person_for_user(db, u)
    await v2dw.sync_person_profile_update(
        db, user_id=u["id"],
        updates={"profile_photo": "p.jpg", "status": "deceased"},
        actor_user=u)
    p = await db.persons.find_one({"id": pid})
    assert p["photo_path"] == "p.jpg"
    assert p["status"] == "deceased"


@pytest.mark.asyncio
async def test_household_update_reflects_on_membership(db):
    u = _user(mobile="9100000050", household_id="hh-old")
    await db.users.insert_one(u)
    pid = await v2dw.ensure_person_for_user(db, u)
    await v2dw.sync_household_update(
        db, user_id=u["id"], household_id="hh-new", actor_user=u)
    mem = await db.memberships.find_one({"person_id": pid, "status": "active"})
    assert mem["household_id"] == "hh-new"


# ============================================================================
# Parity report
# ============================================================================
@pytest.mark.asyncio
async def test_parity_report_clean_environment(db):
    # Two citizens (one with email), one staff. After dual-write the parity
    # report should report ok=True.
    a = _user(name="A", mobile="9100000060", email="a@x.com")
    b = _user(name="B", mobile="9100000061")
    s = _user(role="admin", email="adm@x.com", mobile=None,
              id="u_staff_" + uuid.uuid4().hex[:6])
    await db.users.insert_many([a, b, s])
    pa = await v2dw.ensure_person_for_user(db, a)
    pb = await v2dw.ensure_person_for_user(db, b)
    ps = await v2dw.ensure_person_for_user(db, s)
    # Create one issue and stamp it
    issue = {"id": "iss-100", "tenant_id": a["tenant_id"], "citizen_id": a["id"],
             "issue_code": "ISS-100", "title": "T", "description": "D",
             "category": "Road", "status": "New", "created_at": _now()}
    await db.issues.insert_one(issue)
    await v2dw.sync_issue_to_v2(db, issue, citizen_user=a)

    report = await v2dw.parity_report(db)
    # I1: 2 citizens mapped
    assert report["checks"]["I1_citizens_mapped"]["ok"]
    # I2: no duplicate active mobiles
    assert report["checks"]["I2_mobile_unique_active"]["ok"]
    # I3: each active citizen Person has exactly one active membership
    assert report["checks"]["I3_citizen_one_active_membership"]["ok"]
    # I4-I5: no orphans
    assert report["checks"]["I4_no_orphan_memberships"]["ok"]
    assert report["checks"]["I5_no_orphan_timeline_events"]["ok"]
    # I7: issues all stamped
    assert report["checks"]["I7_issues_have_person_id"]["ok"]
    # I8: issues all have origin_membership_id
    assert report["checks"]["I8_issues_have_origin_membership"]["ok"]
    assert report["ok"]


@pytest.mark.asyncio
async def test_parity_report_catches_unstamped_issue(db):
    u = _user(mobile="9100000070")
    await db.users.insert_one(u)
    await v2dw.ensure_person_for_user(db, u)
    # Insert an issue but DO NOT call sync_issue_to_v2 → should fail parity
    await db.issues.insert_one({
        "id": "iss-bad", "tenant_id": u["tenant_id"], "citizen_id": u["id"],
        "issue_code": "ISS-BAD", "title": "X", "description": "Y",
        "category": "Road", "status": "New", "created_at": _now(),
    })
    report = await v2dw.parity_report(db)
    assert not report["checks"]["I7_issues_have_person_id"]["ok"]
    assert report["checks"]["I7_issues_have_person_id"]["delta"] == 1
    assert not report["ok"]


@pytest.mark.asyncio
async def test_parity_report_catches_orphan_membership(db):
    # Insert a membership with no Person to back it
    await db.memberships.insert_one({
        "id": "m-orphan", "person_id": "p-missing",
        "organisation_id": "tenant-A", "status": "active",
        "scope_type": "constituency",
        "created_at": _now(), "updated_at": _now(),
    })
    report = await v2dw.parity_report(db)
    assert not report["checks"]["I4_no_orphan_memberships"]["ok"]
