"""V2 Citizen Constituency Transfer Workflow — comprehensive tests.

Run:
    cd /app/backend && python -m pytest tests/test_m3_transfer.py -v
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

import v2_dualwrite as v2dw
import v2_transfer as v2tr

load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]


def _now():
    return datetime.now(timezone.utc).isoformat()


class _Addr(BaseModel):
    region_type: str
    house_number: str | None = None
    ward_id: str | None = None
    area_id: str | None = None
    village_id: str | None = None
    address: str
    members_count: int = 1
    family_head_name: str | None = None


@pytest_asyncio.fixture
async def db():
    test_db = f"jansetu_transfer_{uuid.uuid4().hex[:8]}"
    client = AsyncIOMotorClient(MONGO_URL)
    database = client[test_db]
    await database.credentials.create_index(
        [("type", 1), ("value", 1)], unique=True,
        partialFilterExpression={"status": "active"},
        name="cred_type_value_active_unique",
    )
    yield database
    await client.drop_database(test_db)
    client.close()


async def _seed_tenant(db, *, slug: str, name: str) -> str:
    tid = "tenant_" + uuid.uuid4().hex[:8]
    await db.portal_configs.insert_one({
        "id": tid, "slug": slug, "tenant_name": name,
        "politician_name": f"MLA of {name}", "constituency_name": name,
        "status": "active", "created_at": _now(),
    })
    return tid


async def _seed_citizen(db, *, tenant_id: str, mobile: str, name: str = "Rahul") -> dict:
    u = {
        "id": "u_" + uuid.uuid4().hex[:8], "role": "citizen", "name": name,
        "tenant_id": tenant_id, "mobile": mobile, "gender": "m",
        "household_id": "h_" + uuid.uuid4().hex[:6],
        "ward_id": "w_" + uuid.uuid4().hex[:6],
        "address": "Old House", "house_number": "OLD-1",
        "region_type": "urban", "is_active": True,
        "created_at": _now(),
    }
    await db.users.insert_one(u)
    # Seed a household for completeness
    await db.households.insert_one({
        "id": u["household_id"], "tenant_id": tenant_id,
        "household_code": "H-10001",
        "family_head_name": name, "address": "Old House",
        "house_number": "OLD-1", "region_type": "urban",
        "ward_id": u["ward_id"], "members_count": 1, "created_at": _now(),
    })
    await v2dw.ensure_person_for_user(db, u)
    p = await db["_v2_user_to_person"].find_one({"_id": u["id"]})
    mem = await db.memberships.find_one(
        {"person_id": p["person_id"], "organisation_id": tenant_id, "status": "active"})
    await db.users.update_one({"id": u["id"]},
                              {"$set": {"person_id": p["person_id"],
                                        "origin_membership_id": mem["id"]}})
    return await db.users.find_one({"id": u["id"]}, {"_id": 0})


def _now_iso_fn():
    return _now()


async def _next_seq(name, tid):
    """Simple in-test sequence counter."""
    res = await _next_seq.db.counters.find_one_and_update(
        {"_id": f"{name}_{tid}"},
        {"$inc": {"seq": 1}},
        upsert=True, return_document=True,
    )
    return res["seq"]


def _fake_token(uid, role, tid):
    return f"jwt-{uid}-{role}-{tid}"


# ===========================================================================
# detect_transfer_need
# ===========================================================================
@pytest.mark.asyncio
async def test_detect_no_existing_account(db):
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    out = await v2tr.detect_transfer_need(
        db, mobile="9999999999", target_tenant_id=t_b, target_tenant_slug="pune-cantt")
    assert out == {"exists": False}


@pytest.mark.asyncio
async def test_detect_same_tenant_returns_login_hint(db):
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000001")
    out = await v2tr.detect_transfer_need(
        db, mobile="9100000001", target_tenant_id=t_a, target_tenant_slug="kopargaon")
    assert out["exists"] is True
    assert out["same_tenant"] is True


@pytest.mark.asyncio
async def test_detect_cross_tenant_returns_transfer_payload(db):
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000002", name="Rahul")
    out = await v2tr.detect_transfer_need(
        db, mobile="9100000002", target_tenant_id=t_b, target_tenant_slug="pune-cantt")
    assert out["exists"] and out["can_transfer"]
    assert not out["same_tenant"]
    assert out["current_tenant"]["slug"] == "kopargaon"
    assert out["target_tenant"]["slug"] == "pune-cantt"


# ===========================================================================
# initiate_transfer
# ===========================================================================
@pytest.mark.asyncio
async def test_initiate_creates_transfer_request_and_otp(db):
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000010")
    res = await v2tr.initiate_transfer(
        db, mobile="9100000010", target_tenant_slug="pune-cantt", reason="job")
    assert res["transfer_request_id"].startswith("tr_")
    assert res["demo_otp"] == "123456"
    tr = await db.transfer_requests.find_one({"id": res["transfer_request_id"]})
    assert tr["status"] == "otp_pending"
    assert tr["to_organisation_id"] == t_b
    otp = await db.otps.find_one({"transfer_request_id": res["transfer_request_id"]})
    assert otp and otp["otp"] == "123456"


@pytest.mark.asyncio
async def test_initiate_same_tenant_rejected(db):
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000011")
    with pytest.raises(ValueError, match="already registered"):
        await v2tr.initiate_transfer(
            db, mobile="9100000011", target_tenant_slug="kopargaon", reason=None)


@pytest.mark.asyncio
async def test_initiate_unknown_target_rejected(db):
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000012")
    with pytest.raises(ValueError, match="Target portal not found"):
        await v2tr.initiate_transfer(
            db, mobile="9100000012", target_tenant_slug="nonexistent", reason=None)


@pytest.mark.asyncio
async def test_initiate_no_existing_account(db):
    await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    with pytest.raises(ValueError, match="No existing account"):
        await v2tr.initiate_transfer(
            db, mobile="9999999999", target_tenant_slug="pune-cantt", reason=None)


# ===========================================================================
# verify_and_execute_transfer — happy path
# ===========================================================================
@pytest.mark.asyncio
async def test_full_transfer_happy_path(db):
    _next_seq.db = db
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    old_user = await _seed_citizen(db, tenant_id=t_a, mobile="9100000020", name="Rahul")
    pid = old_user["person_id"]
    old_mid = old_user["origin_membership_id"]

    # Seed an old issue (so we can verify history isolation)
    await db.issues.insert_one({
        "id": "iss-old-1", "tenant_id": t_a, "citizen_id": old_user["id"],
        "person_id": pid, "origin_membership_id": old_mid,
        "issue_code": "ISS-OLD-1", "title": "Pothole", "status": "Resolved",
        "category": "Road", "created_at": _now(),
    })

    init = await v2tr.initiate_transfer(
        db, mobile="9100000020", target_tenant_slug="pune-cantt",
        reason="job")
    new_addr = _Addr(region_type="urban", house_number="NEW-10",
                     ward_id="w_new", address="New Lane", members_count=2,
                     family_head_name="Rahul")
    res = await v2tr.verify_and_execute_transfer(
        db, transfer_request_id=init["transfer_request_id"], otp="123456",
        new_address=new_addr, next_seq_fn=_next_seq,
        create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)

    # ---------- new V1 user created ----------
    new_user = res["user"]
    assert new_user["tenant_id"] == t_b
    assert new_user["mobile"] == "9100000020"
    assert new_user["person_id"] == pid
    assert new_user["household_id"] == res["household"]["id"]
    assert new_user["address"] == "New Lane"

    # ---------- old V1 user still exists but is_active=False ----------
    old_v1 = await db.users.find_one({"id": old_user["id"]})
    assert old_v1["is_active"] is False
    assert old_v1["_transferred_out_to_user_id"] == new_user["id"]

    # ---------- Person updated cache ----------
    p = await db.persons.find_one({"id": pid})
    assert p["current_organisation_id"] == t_b
    assert p["current_membership_id"] == res["person"]["current_membership_id"]

    # ---------- exactly ONE active membership for the Person ----------
    active_mems = await db.memberships.find(
        {"person_id": pid, "status": "active"}).to_list(10)
    assert len(active_mems) == 1
    new_mid = active_mems[0]["id"]
    assert active_mems[0]["organisation_id"] == t_b
    assert active_mems[0]["transferred_from_membership_id"] == old_mid

    # ---------- old membership archived & cross-linked ----------
    old_archived = await db.memberships.find_one({"id": old_mid})
    assert old_archived["status"] == "archived"
    assert old_archived["archive_reason"] == "transferred"
    assert old_archived["transferred_to_membership_id"] == new_mid
    assert old_archived["transferred_to_organisation_id"] == t_b
    assert old_archived["end_date"]

    # ---------- mobile credential still active & still tied to same Person ----------
    creds = await db.credentials.find({"value": "9100000020", "status": "active"}).to_list(5)
    assert len(creds) == 1 and creds[0]["person_id"] == pid

    # ---------- audits ----------
    pa_events = [a["event"] async for a in db.person_audit.find({"person_id": pid})]
    assert "transferred_out" in pa_events
    assert "transferred_in" in pa_events
    ma = await db.membership_audit.find({"person_id": pid}).to_list(20)
    ma_events = {(m["membership_id"], m["event"]) for m in ma}
    assert (old_mid, "archived") in ma_events
    assert (old_mid, "transferred_out") in ma_events
    assert (new_mid, "created") in ma_events
    assert (new_mid, "transferred_in") in ma_events
    assert (old_mid, "cross_linked") in ma_events

    # ---------- timeline events on both orgs ----------
    tl = [(e["organisation_id"], e["event_type"]) async for e in
          db.person_timeline_events.find({"person_id": pid})]
    assert (t_a, "membership_archived") in tl
    assert (t_a, "membership_transferred") in tl
    assert (t_b, "membership_created") in tl

    # ---------- old operational data untouched ----------
    old_issue = await db.issues.find_one({"id": "iss-old-1"})
    assert old_issue["tenant_id"] == t_a
    assert old_issue["origin_membership_id"] == old_mid
    # New tenant query filtered by tenant_id MUST NOT return old issue.
    new_visible = await db.issues.find({"tenant_id": t_b}).to_list(10)
    assert all(i["id"] != "iss-old-1" for i in new_visible)

    # ---------- consents auto-granted for new org ----------
    consents = await db.person_consents.find(
        {"person_id": pid, "organisation_id": t_b}).to_list(5)
    scopes = {c["scope"] for c in consents}
    assert {"tier1", "tier2"}.issubset(scopes)


# ===========================================================================
# Family relationships survive transfer
# ===========================================================================
@pytest.mark.asyncio
async def test_family_relationships_survive_transfer(db):
    _next_seq.db = db
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    rahul = await _seed_citizen(db, tenant_id=t_a, mobile="9100000030", name="Rahul")
    father = await _seed_citizen(db, tenant_id=t_a, mobile="9100000031", name="Father")
    # Build relationship in V1 + V2
    rel = {"id": "rel-1", "tenant_id": t_a, "person_a": father["id"],
           "person_b": rahul["id"], "type": "Father", "created_at": _now()}
    await db.relationships.insert_one(rel)
    await v2dw.sync_relationship_to_v2(
        db, rel=rel,
        actor_user={"id": "actor", "tenant_id": t_a, "role": "pa"})
    # Sanity: relationships_v2 row uses person_ids.
    rel_v2 = await db.relationships_v2.find_one({"_v1_relationship_id": "rel-1"})
    assert rel_v2["from_person_id"] == father["person_id"]
    assert rel_v2["to_person_id"] == rahul["person_id"]
    # Transfer Rahul.
    init = await v2tr.initiate_transfer(
        db, mobile="9100000030", target_tenant_slug="pune-cantt", reason=None)
    addr = _Addr(region_type="urban", house_number="NEW-2",
                 ward_id="w_new", address="New Lane", members_count=1)
    await v2tr.verify_and_execute_transfer(
        db, transfer_request_id=init["transfer_request_id"], otp="123456",
        new_address=addr, next_seq_fn=_next_seq,
        create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)
    # relationships_v2 still uses the SAME person_ids → relationship intact.
    rel_v2_after = await db.relationships_v2.find_one({"_v1_relationship_id": "rel-1"})
    assert rel_v2_after["status"] == "active"
    assert rel_v2_after["from_person_id"] == father["person_id"]
    assert rel_v2_after["to_person_id"] == rahul["person_id"]


# ===========================================================================
# Idempotency
# ===========================================================================
@pytest.mark.asyncio
async def test_transfer_is_idempotent_on_replay(db):
    _next_seq.db = db
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    u = await _seed_citizen(db, tenant_id=t_a, mobile="9100000040")
    init = await v2tr.initiate_transfer(
        db, mobile="9100000040", target_tenant_slug="pune-cantt", reason=None)
    addr = _Addr(region_type="urban", house_number="NEW-3",
                 ward_id="w_new", address="New Lane")
    out1 = await v2tr.verify_and_execute_transfer(
        db, transfer_request_id=init["transfer_request_id"], otp="123456",
        new_address=addr, next_seq_fn=_next_seq,
        create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)
    out2 = await v2tr.verify_and_execute_transfer(
        db, transfer_request_id=init["transfer_request_id"], otp="123456",
        new_address=addr, next_seq_fn=_next_seq,
        create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)
    # Both should reference the same new user / membership / household
    assert out1["user"]["id"] == out2["user"]["id"]
    assert out1["household"]["id"] == out2["household"]["id"]
    # And no duplicate active memberships.
    active = await db.memberships.count_documents(
        {"person_id": u["person_id"], "status": "active"})
    assert active == 1
    # And no duplicate Person.
    assert await db.persons.count_documents({"id": u["person_id"]}) == 1


@pytest.mark.asyncio
async def test_concurrent_second_membership_rejected(db):
    """If somehow a second active membership exists for the same person in
    target tenant, the source-membership active check prevents a re-transfer
    after the first completes (source becomes archived)."""
    _next_seq.db = db
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000050")
    init = await v2tr.initiate_transfer(
        db, mobile="9100000050", target_tenant_slug="pune-cantt", reason=None)
    addr = _Addr(region_type="urban", house_number="NEW-4",
                 ward_id="w_new", address="New Lane")
    await v2tr.verify_and_execute_transfer(
        db, transfer_request_id=init["transfer_request_id"], otp="123456",
        new_address=addr, next_seq_fn=_next_seq,
        create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)
    # Second attempt now resolves to the NEW user (Pune); initiating a transfer
    # to the same tenant is correctly rejected.
    with pytest.raises(ValueError, match="already registered in this constituency"):
        await v2tr.initiate_transfer(
            db, mobile="9100000050", target_tenant_slug="pune-cantt",
            reason=None)


# ===========================================================================
# OTP / expiry
# ===========================================================================
@pytest.mark.asyncio
async def test_invalid_otp_rejected(db):
    _next_seq.db = db
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000060")
    init = await v2tr.initiate_transfer(
        db, mobile="9100000060", target_tenant_slug="pune-cantt", reason=None)
    addr = _Addr(region_type="urban", house_number="NEW-5",
                 ward_id="w_new", address="New Lane")
    with pytest.raises(ValueError, match="Invalid OTP"):
        await v2tr.verify_and_execute_transfer(
            db, transfer_request_id=init["transfer_request_id"], otp="abc",
            new_address=addr, next_seq_fn=_next_seq,
            create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)


@pytest.mark.asyncio
async def test_expired_request_rejected(db):
    _next_seq.db = db
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    await _seed_citizen(db, tenant_id=t_a, mobile="9100000070")
    init = await v2tr.initiate_transfer(
        db, mobile="9100000070", target_tenant_slug="pune-cantt", reason=None)
    # Force-expire the request.
    await db.transfer_requests.update_one(
        {"id": init["transfer_request_id"]},
        {"$set": {"expires_at": "2020-01-01T00:00:00+00:00"}},
    )
    addr = _Addr(region_type="urban", house_number="NEW-6",
                 ward_id="w_new", address="New Lane")
    with pytest.raises(ValueError, match="expired"):
        await v2tr.verify_and_execute_transfer(
            db, transfer_request_id=init["transfer_request_id"], otp="123456",
            new_address=addr, next_seq_fn=_next_seq,
            create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)


# ===========================================================================
# Membership history view
# ===========================================================================
@pytest.mark.asyncio
async def test_membership_history_after_transfer(db):
    _next_seq.db = db
    t_a = await _seed_tenant(db, slug="kopargaon", name="Kopargaon")
    t_b = await _seed_tenant(db, slug="pune-cantt", name="Pune Cantonment")
    u = await _seed_citizen(db, tenant_id=t_a, mobile="9100000080")
    init = await v2tr.initiate_transfer(
        db, mobile="9100000080", target_tenant_slug="pune-cantt", reason=None)
    addr = _Addr(region_type="urban", house_number="NEW-7",
                 ward_id="w_new", address="New Lane")
    await v2tr.verify_and_execute_transfer(
        db, transfer_request_id=init["transfer_request_id"], otp="123456",
        new_address=addr, next_seq_fn=_next_seq,
        create_token_fn=_fake_token, now_iso_fn=_now_iso_fn)
    history = await v2tr.get_person_membership_history(db, person_id=u["person_id"])
    assert len(history) == 2
    statuses = {m["status"] for m in history}
    assert {"archived", "active"} == statuses
