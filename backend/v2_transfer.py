"""V2 — Citizen Constituency Transfer Workflow.

Implements the transfer of a Person's active Membership from one Organisation
to another while preserving ALL historical data (issues, visits, devworks,
interactions, notifications, household, family relationships).

Design tenets:
    - Atomic-ish via idempotency keys. Each step is safe to re-run with the
      same TransferRequest id (we cross-reference IDs on success).
    - History never deleted. Old Membership becomes status='archived' and
      back-points at the new Membership via `transferred_to_membership_id`.
    - V1 user-row strategy: keep one row PER (tenant, person). After transfer
      the OLD user row is marked `is_active=False` and stays for tenant-A
      historical reports; a NEW user row is created for tenant B and gets
      mapped to the same Person id.
    - Family relationships are person-id-linked (not user-id-linked) so they
      remain intact automatically.
    - Active mobile credential is GLOBAL (one Person owns it); no change
      needed on the credential during transfer.
    - All operational records keep their original tenant_id and
      origin_membership_id so the previous constituency retains the same
      read access it had before; the new constituency cannot see them.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger("v2_transfer")

TRANSFER_EXPIRY_MINUTES = 10
DUALWRITE_MARKER = "transfer_v2"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _expiry() -> str:
    return (datetime.now(timezone.utc)
            + timedelta(minutes=TRANSFER_EXPIRY_MINUTES)).isoformat()


def _is_expired(iso: str) -> bool:
    try:
        return datetime.fromisoformat(iso) < datetime.now(timezone.utc)
    except Exception:
        return False


def _nid(prefix: str = "") -> str:
    return (prefix + str(uuid.uuid4())) if prefix else str(uuid.uuid4())


# ----------------------------------------------------------------------------
# Lookup helpers — called by the /check-mobile endpoint
# ----------------------------------------------------------------------------
async def lookup_existing_citizen(db, *, mobile: str) -> Optional[dict]:
    """Find any ACTIVE citizen V1 user with this mobile across all tenants.

    Returns the user dict (with V2 Person info attached) or None.
    The transfer workflow assumes 'one mobile = one Person globally' — the
    M2 dedupe report (`/app/migrations/dedupe_20260625.csv`) is the prereq
    that guarantees this invariant.
    """
    user = await db.users.find_one(
        {"mobile": mobile, "role": "citizen", "is_active": True},
        {"_id": 0, "password_hash": 0},
    )
    return user


async def detect_transfer_need(db, *, mobile: str, target_tenant_id: str,
                               target_tenant_slug: str) -> dict:
    """Decide whether a mobile-number registration at `target_tenant_id` should
    be re-routed through the transfer workflow.

    Returns a structured payload the frontend uses to drive the UX dialog.
    """
    user = await lookup_existing_citizen(db, mobile=mobile)
    if not user:
        return {"exists": False}
    current_tenant_id = user.get("tenant_id")
    if current_tenant_id == target_tenant_id:
        # Same constituency → not a transfer, route to login.
        return {
            "exists": True,
            "same_tenant": True,
            "tenant_id": current_tenant_id,
            "name": user.get("name"),
        }
    # Cross-tenant → transfer candidate.
    current = await db.portal_configs.find_one(
        {"id": current_tenant_id}, {"_id": 0, "id": 1, "slug": 1, "politician_name": 1, "tenant_name": 1, "constituency_name": 1},
    )
    target = await db.portal_configs.find_one(
        {"slug": target_tenant_slug}, {"_id": 0, "id": 1, "slug": 1, "politician_name": 1, "tenant_name": 1, "constituency_name": 1},
    )
    person_id = user.get("person_id")
    return {
        "exists": True,
        "same_tenant": False,
        "can_transfer": True,
        "person_id": person_id,
        "masked_name": user.get("name"),
        "current_tenant": current,
        "target_tenant": target,
        "from_user_id": user["id"],
    }


# ----------------------------------------------------------------------------
# Initiate
# ----------------------------------------------------------------------------
async def initiate_transfer(db, *, mobile: str, target_tenant_slug: str,
                            reason: Optional[str]) -> dict:
    """Create a TransferRequest and send the (mocked) OTP.

    Returns {"transfer_request_id", "expires_at", "demo_otp"} on success.
    Raises ValueError on validation errors (translated to HTTPException by
    the route layer).
    """
    target = await db.portal_configs.find_one({"slug": target_tenant_slug}, {"_id": 0})
    if not target:
        raise ValueError("Target portal not found")
    user = await lookup_existing_citizen(db, mobile=mobile)
    if not user:
        raise ValueError("No existing account with this mobile number")
    if user.get("tenant_id") == target["id"]:
        raise ValueError("You are already registered in this constituency")
    pid = user.get("person_id")
    if not pid:
        raise ValueError("Person record missing — contact support")
    # Lookup active membership in source tenant.
    source_mem = await db.memberships.find_one({
        "person_id": pid,
        "organisation_id": user["tenant_id"],
        "status": "active",
        "scope_type": "constituency",
    })
    if not source_mem:
        raise ValueError("Active membership not found in source constituency")

    req_id = _nid("tr_")
    req = {
        "id": req_id,
        "person_id": pid,
        "mobile": mobile,
        "from_user_id": user["id"],
        "from_organisation_id": user["tenant_id"],
        "from_membership_id": source_mem["id"],
        "to_tenant_slug": target_tenant_slug,
        "to_organisation_id": target["id"],
        "reason": reason,
        "status": "otp_pending",
        "otp_attempts": 0,
        "created_at": _now(),
        "expires_at": _expiry(),
    }
    await db.transfer_requests.insert_one(req)

    # Mock OTP (will be replaced by Fast2SMS provider later).
    await db.otps.update_one(
        {"mobile": mobile, "tenant_slug": target_tenant_slug},
        {"$set": {"mobile": mobile, "tenant_slug": target_tenant_slug,
                  "otp": "123456", "at": _now(),
                  "transfer_request_id": req_id}},
        upsert=True,
    )
    return {"transfer_request_id": req_id,
            "expires_at": req["expires_at"],
            "demo_otp": "123456",
            "mobile": mobile}


# ----------------------------------------------------------------------------
# Verify + Execute
# ----------------------------------------------------------------------------
async def _emit_membership_audit(db, *, membership_id: str, person_id: str,
                                 organisation_id: str, event: str,
                                 by_user_id: Optional[str] = None,
                                 by_tenant_id: Optional[str] = None,
                                 payload: Optional[dict] = None) -> None:
    try:
        await db.membership_audit.insert_one({
            "id": _nid("ma_"),
            "membership_id": membership_id,
            "person_id": person_id,
            "organisation_id": organisation_id,
            "event": event,
            "at": _now(),
            "by_user_id": by_user_id,
            "by_tenant_id": by_tenant_id,
            "payload": payload or {},
        })
    except Exception:
        logger.exception("transfer: membership_audit insert failed")


async def _emit_person_audit(db, *, person_id: str, event: str,
                             by_user_id: Optional[str] = None,
                             by_tenant_id: Optional[str] = None,
                             payload: Optional[dict] = None) -> None:
    try:
        await db.person_audit.insert_one({
            "id": _nid("a_"), "person_id": person_id, "event": event,
            "at": _now(), "by_user_id": by_user_id,
            "by_tenant_id": by_tenant_id, "payload": payload or {},
        })
    except Exception:
        logger.exception("transfer: person_audit insert failed")


async def _emit_timeline(db, *, person_id: str, organisation_id: str,
                         membership_id: str, event_type: str, label: str,
                         summary: Optional[str] = None,
                         ref_id: Optional[str] = None) -> None:
    try:
        await db.person_timeline_events.insert_one({
            "id": _nid("t_"), "person_id": person_id,
            "organisation_id": organisation_id,
            "membership_id": membership_id,
            "event_type": event_type, "at": _now(),
            "ref_collection": "memberships", "ref_id": ref_id or membership_id,
            "label": label, "summary": summary, "tier": "public",
        })
    except Exception:
        logger.exception("transfer: timeline insert failed")


async def _find_or_create_household(db, *, tenant_id: str,
                                    new_address, person_name: str,
                                    next_seq_fn) -> str:
    """Find an existing household matching house_number+ward/village or mint a
    new one. Returns the household id.
    """
    if new_address.house_number:
        q = {"house_number": new_address.house_number, "tenant_id": tenant_id}
        if new_address.ward_id:
            q["ward_id"] = new_address.ward_id
        if new_address.village_id:
            q["village_id"] = new_address.village_id
        existing = await db.households.find_one(q)
        if existing:
            await db.households.update_one(
                {"id": existing["id"]},
                {"$inc": {"members_count": new_address.members_count or 1}},
            )
            return existing["id"]
    # Mint new household with tenant-scoped code.
    hh_seq = await next_seq_fn("household", tenant_id)
    hh_code = f"H-{10000 + hh_seq}"
    hh_id = _nid()
    await db.households.insert_one({
        "id": hh_id, "tenant_id": tenant_id, "household_code": hh_code,
        "family_head_name": new_address.family_head_name or person_name,
        "address": new_address.address,
        "house_number": new_address.house_number,
        "region_type": new_address.region_type,
        "ward_id": new_address.ward_id,
        "area_id": new_address.area_id,
        "village_id": new_address.village_id,
        "members_count": new_address.members_count,
        "created_at": _now(),
    })
    return hh_id


async def verify_and_execute_transfer(db, *, transfer_request_id: str, otp: str,
                                      new_address, next_seq_fn,
                                      create_token_fn,
                                      now_iso_fn) -> dict:
    """Atomic-ish execution of the transfer flow.

    Steps:
        1. Validate OTP + load request.
        2. Re-load source Person, source Membership, source V1 user.
        3. Mint new household in target tenant.
        4. Create new V1 user row in target tenant; map to same Person.
        5. Create new Membership (transferred_from = old_mid).
        6. Cross-link: old.transferred_to_membership_id = new_mid;
           old.status='archived', old.archive_reason='transferred',
           old.transferred_to_organisation_id = new_org.
        7. Mark old V1 user is_active=False (preserves history; blocks login).
        8. Update Person: current_organisation_id, current_membership_id.
        9. Auto consents (tier1+tier2) for the new org, source='auto_on_transfer'.
        10. Emit MembershipAudit (archived + created + cross_linked),
           PersonAudit (transferred_out + transferred_in),
           Timeline events (membership_archived, membership_transferred,
           membership_created).
        11. Mark TransferRequest status=completed.

    Idempotent: if request.status='completed' already, the prior outcome is
    returned without re-running steps.
    """
    req = await db.transfer_requests.find_one({"id": transfer_request_id})
    if not req:
        raise ValueError("Invalid transfer_request_id")
    if req["status"] == "completed":
        # Idempotent replay
        return await _build_transfer_response(db, req, create_token_fn)
    if req["status"] != "otp_pending":
        raise ValueError(f"Transfer request is {req['status']}; cannot proceed")
    if req.get("expires_at") and _is_expired(req["expires_at"]):
        await db.transfer_requests.update_one(
            {"id": transfer_request_id}, {"$set": {"status": "expired"}})
        raise ValueError("Transfer request expired — please initiate again")

    # OTP check (mocked: any 6-digit; we still bump otp_attempts).
    await db.transfer_requests.update_one(
        {"id": transfer_request_id}, {"$inc": {"otp_attempts": 1}})
    if otp != "123456" and len(otp) != 6:
        raise ValueError("Invalid OTP")

    pid = req["person_id"]
    from_user = await db.users.find_one({"id": req["from_user_id"]}, {"_id": 0})
    if not from_user:
        raise ValueError("Source citizen record missing")
    person = await db.persons.find_one({"id": pid}, {"_id": 0})
    if not person:
        raise ValueError("Person record missing")
    old_mem = await db.memberships.find_one({"id": req["from_membership_id"]}, {"_id": 0})
    if not old_mem or old_mem.get("status") != "active":
        # Could be a concurrent transfer; reject.
        raise ValueError("Source membership is no longer active")

    # Step 3 — mint new household in target tenant.
    new_hh_id = await _find_or_create_household(
        db, tenant_id=req["to_organisation_id"], new_address=new_address,
        person_name=person.get("name") or from_user.get("name") or "Citizen",
        next_seq_fn=next_seq_fn,
    )

    # Step 4 — create new V1 user row in target tenant.
    new_user_id = _nid()
    new_user_doc = {
        "id": new_user_id,
        "role": "citizen",
        "name": person.get("name") or from_user.get("name"),
        "tenant_id": req["to_organisation_id"],
        "email": from_user.get("email") or person.get("email"),
        "mobile": req["mobile"],
        "password_hash": None,
        "gender": person.get("gender") or from_user.get("gender"),
        "dob": person.get("dob") or from_user.get("dob"),
        "household_id": new_hh_id,
        "constituency_id": None,
        "ward_id": new_address.ward_id,
        "area_id": new_address.area_id,
        "village_id": new_address.village_id,
        "booth_id": None,
        "region_type": new_address.region_type,
        "house_number": new_address.house_number,
        "address": new_address.address,
        "designation": None,
        "must_change_password": False,
        "profile_photo": from_user.get("profile_photo"),
        "notes": None,
        "status": "alive",
        "date_of_death": None,
        "supporter_since": None,
        "political_role": None,
        "influence_level": None,
        "political_notes": None,
        "family_lineage": [],
        "is_active": True,
        "created_at": now_iso_fn(),
        "person_id": pid,
    }
    await db.users.insert_one(new_user_doc)
    # Map new V1 user_id → same Person id
    await db["_v2_user_to_person"].update_one(
        {"_id": new_user_id},
        {"$set": {"person_id": pid, "at": _now(),
                  "_transfer_request_id": transfer_request_id}},
        upsert=True,
    )

    # Step 5 — create new Membership.
    new_mid = _nid("m_")
    new_mem = {
        "id": new_mid, "person_id": pid,
        "organisation_id": req["to_organisation_id"],
        "scope_type": "constituency",
        "household_id": new_hh_id,
        "ward_id": new_address.ward_id,
        "village_id": new_address.village_id,
        "state": None, "district": None, "taluka": None,
        "address": new_address.address,
        "start_date": _now(), "end_date": None,
        "status": "active",
        "transfer_reason": req.get("reason"),
        "transferred_from_membership_id": old_mem["id"],
        "transferred_to_membership_id": None,
        "transferred_to_organisation_id": None,
        "archive_reason": None,
        "is_primary": True,
        "created_at": _now(), "updated_at": _now(),
        "_origin_user_id": new_user_id,
        "_transfer_request_id": transfer_request_id,
    }
    await db.memberships.insert_one(new_mem)
    # Stamp origin_membership_id on the new V1 user row.
    await db.users.update_one(
        {"id": new_user_id},
        {"$set": {"origin_membership_id": new_mid}},
    )

    # Step 6 — archive old Membership + cross-link.
    await db.memberships.update_one(
        {"id": old_mem["id"]},
        {"$set": {
            "status": "archived",
            "end_date": _now(),
            "archive_reason": "transferred",
            "transferred_to_membership_id": new_mid,
            "transferred_to_organisation_id": req["to_organisation_id"],
            "transfer_reason": req.get("reason"),
            "updated_at": _now(),
        }},
    )

    # Step 7 — deactivate old V1 user (preserves history; blocks login).
    await db.users.update_one(
        {"id": req["from_user_id"]},
        {"$set": {"is_active": False,
                  "_transferred_out_to_user_id": new_user_id,
                  "_transferred_out_at": _now()}},
    )

    # Step 8 — update Person cache.
    await db.persons.update_one(
        {"id": pid},
        {"$set": {
            "current_organisation_id": req["to_organisation_id"],
            "current_membership_id": new_mid,
            "updated_at": _now(),
        }},
    )

    # Step 9 — auto consents for new org.
    for tier in ("tier1", "tier2"):
        try:
            await db.person_consents.insert_one({
                "id": _nid("k_"), "person_id": pid,
                "organisation_id": req["to_organisation_id"],
                "scope": tier, "granted_at": _now(),
                "revoked_at": None, "source": "auto_on_transfer",
            })
        except Exception:
            pass

    # Step 10 — audits + timeline.
    await _emit_membership_audit(
        db, membership_id=old_mem["id"], person_id=pid,
        organisation_id=req["from_organisation_id"],
        event="archived",
        payload={"reason": "transferred",
                 "to_organisation_id": req["to_organisation_id"],
                 "to_membership_id": new_mid,
                 "transfer_request_id": transfer_request_id})
    await _emit_membership_audit(
        db, membership_id=old_mem["id"], person_id=pid,
        organisation_id=req["from_organisation_id"], event="transferred_out",
        payload={"to_membership_id": new_mid,
                 "transfer_request_id": transfer_request_id})
    await _emit_membership_audit(
        db, membership_id=new_mid, person_id=pid,
        organisation_id=req["to_organisation_id"], event="created",
        payload={"from_membership_id": old_mem["id"],
                 "from_organisation_id": req["from_organisation_id"],
                 "transfer_request_id": transfer_request_id})
    await _emit_membership_audit(
        db, membership_id=new_mid, person_id=pid,
        organisation_id=req["to_organisation_id"], event="transferred_in",
        payload={"from_membership_id": old_mem["id"],
                 "from_organisation_id": req["from_organisation_id"],
                 "transfer_request_id": transfer_request_id})
    await _emit_membership_audit(
        db, membership_id=old_mem["id"], person_id=pid,
        organisation_id=req["from_organisation_id"], event="cross_linked",
        payload={"to_membership_id": new_mid})

    await _emit_person_audit(
        db, person_id=pid, event="transferred_out",
        by_tenant_id=req["from_organisation_id"],
        payload={"to_organisation_id": req["to_organisation_id"],
                 "old_membership_id": old_mem["id"],
                 "new_membership_id": new_mid,
                 "transfer_request_id": transfer_request_id})
    await _emit_person_audit(
        db, person_id=pid, event="transferred_in",
        by_tenant_id=req["to_organisation_id"],
        payload={"from_organisation_id": req["from_organisation_id"],
                 "old_membership_id": old_mem["id"],
                 "new_membership_id": new_mid,
                 "transfer_request_id": transfer_request_id})

    # Timeline: in old org → membership_archived + membership_transferred.
    await _emit_timeline(
        db, person_id=pid, organisation_id=req["from_organisation_id"],
        membership_id=old_mem["id"], event_type="membership_archived",
        label="Membership archived",
        summary=f"Transferred to {req['to_tenant_slug']}",
        ref_id=old_mem["id"])
    await _emit_timeline(
        db, person_id=pid, organisation_id=req["from_organisation_id"],
        membership_id=old_mem["id"], event_type="membership_transferred",
        label="Transferred to new constituency",
        summary=req.get("reason"),
        ref_id=new_mid)
    # Timeline: in new org → membership_created.
    await _emit_timeline(
        db, person_id=pid, organisation_id=req["to_organisation_id"],
        membership_id=new_mid, event_type="membership_created",
        label="New membership created",
        summary="Transferred from previous constituency",
        ref_id=new_mid)

    # Step 11 — mark transfer request as completed.
    await db.transfer_requests.update_one(
        {"id": transfer_request_id},
        {"$set": {"status": "completed",
                  "new_user_id": new_user_id,
                  "new_membership_id": new_mid,
                  "new_household_id": new_hh_id,
                  "completed_at": _now()}},
    )
    fresh = await db.transfer_requests.find_one({"id": transfer_request_id})
    return await _build_transfer_response(db, fresh, create_token_fn)


async def _build_transfer_response(db, req: dict, create_token_fn) -> dict:
    user = await db.users.find_one({"id": req["new_user_id"]},
                                   {"_id": 0, "password_hash": 0})
    hh = await db.households.find_one({"id": req["new_household_id"]}, {"_id": 0})
    from_portal = await db.portal_configs.find_one(
        {"id": req["from_organisation_id"]},
        {"_id": 0, "id": 1, "slug": 1, "politician_name": 1,
         "tenant_name": 1, "constituency_name": 1},
    )
    person = await db.persons.find_one({"id": req["person_id"]}, {"_id": 0})
    token = create_token_fn(req["new_user_id"], "citizen", req["to_organisation_id"])
    return {
        "token": token,
        "user": user,
        "household": hh,
        "person": {
            "id": req["person_id"],
            "current_organisation_id": person.get("current_organisation_id") if person else None,
            "current_membership_id": person.get("current_membership_id") if person else None,
        },
        "transferred_from": {
            "organisation": from_portal,
            "archived_membership_id": req["from_membership_id"],
            "old_user_id": req["from_user_id"],
        },
        "transferred_at": req.get("completed_at"),
    }


# ----------------------------------------------------------------------------
# Historical view helpers (used by frontend Person 360 — M4)
# ----------------------------------------------------------------------------
async def get_person_membership_history(db, *, person_id: str) -> list[dict]:
    """Returns the full membership history for a Person — used by the
    Constituency Transfer banner ("Transferred to <Org>" / "Transferred from
    <Org>") and the future Person 360 view. Tenants only see rows belonging
    to themselves; callers handle that filter at the route layer.
    """
    rows = await db.memberships.find(
        {"person_id": person_id},
        {"_id": 0},
    ).sort("start_date", 1).to_list(50)
    return rows
