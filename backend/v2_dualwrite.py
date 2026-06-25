"""M3 — Dual-Write Helpers (Phase M3).

Principle:
    V1 writes remain authoritative. Every successful V1 write also emits the
    corresponding V2 rows in the same request handler. Failures in the V2
    mirror are LOGGED but do not break V1 — V1 durability is non-negotiable.

Contract for each helper:
    - Idempotent: re-running for the same V1 row creates no duplicates.
    - Best-effort: never raises; failures logged; nightly parity_report() will
      flag deltas for backfill.
    - Stamping: also writes V2 fields back onto the V1 row (`person_id`,
      `origin_membership_id`) so V1 reads can adopt them progressively.

Invariants enforced in helpers:
    - One Person per (V1) user (anchored via `_v2_user_to_person`).
    - Exactly one ACTIVE Membership per (Person, Organisation).
    - At most one ACTIVE mobile credential per Person (DB unique index also
      enforces (type, value, status=active) globally).
    - Operational records always stamp `origin_membership_id` belonging to
      the ACTIVE membership of the acting Person in that tenant.
    - `Person.current_organisation_id` is null for staff Persons.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("v2_dualwrite")

# Marker used by the nightly parity asserter to attribute V2 rows back to the
# write that created them.
DUALWRITE_MARKER = "dualwrite_m3"

STAFF_ROLES = {"worker", "pa", "politician", "admin", "super_admin"}

# Map V1 role → V2 Person.types entry.
_ROLE_TO_PERSON_TYPE = {
    "citizen": "citizen", "worker": "worker", "pa": "staff",
    "politician": "politician", "admin": "staff", "super_admin": "staff",
}


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _nid(prefix: str = "") -> str:
    return (prefix + str(uuid.uuid4())) if prefix else str(uuid.uuid4())


async def _get_mapped_person_id(db, user_id: str) -> Optional[str]:
    row = await db["_v2_user_to_person"].find_one({"_id": user_id})
    return row["person_id"] if row else None


async def _set_mapped_person_id(db, user_id: str, person_id: str) -> None:
    await db["_v2_user_to_person"].update_one(
        {"_id": user_id},
        {"$set": {"person_id": person_id, "_dualwrite_marker": DUALWRITE_MARKER, "at": _now()}},
        upsert=True,
    )


async def _emit_audit(db, person_id: str, event: str, *,
                     by_user_id: Optional[str] = None,
                     by_tenant_id: Optional[str] = None,
                     payload: Optional[dict] = None) -> None:
    try:
        await db.person_audit.insert_one({
            "id": _nid("a_"), "person_id": person_id, "event": event,
            "at": _now(), "by_user_id": by_user_id,
            "by_tenant_id": by_tenant_id, "payload": payload or {},
            "_dualwrite_marker": DUALWRITE_MARKER,
        })
    except Exception:
        logger.exception("dualwrite: audit write failed")


async def _emit_timeline(db, *, person_id: str, organisation_id: Optional[str],
                         membership_id: Optional[str], event_type: str,
                         label: str, summary: Optional[str] = None,
                         ref_collection: Optional[str] = None,
                         ref_id: Optional[str] = None,
                         at: Optional[str] = None,
                         tier: str = "operational") -> None:
    try:
        await db.person_timeline_events.insert_one({
            "id": _nid("t_"), "person_id": person_id,
            "organisation_id": organisation_id,
            "membership_id": membership_id,
            "event_type": event_type,
            "at": at or _now(),
            "ref_collection": ref_collection, "ref_id": ref_id,
            "label": label, "summary": summary, "tier": tier,
            "_dualwrite_marker": DUALWRITE_MARKER,
        })
    except Exception:
        logger.exception("dualwrite: timeline write failed")


def _membership_doc_from_citizen(*, person_id: str, user: dict) -> dict:
    return {
        "id": _nid("m_"),
        "person_id": person_id,
        "organisation_id": user.get("tenant_id"),
        "scope_type": "constituency",
        "household_id": user.get("household_id"),
        "ward_id": user.get("ward_id"),
        "village_id": user.get("village_id"),
        "state": user.get("state"),
        "district": user.get("district"),
        "taluka": user.get("taluka"),
        "address": user.get("address"),
        "start_date": user.get("created_at") or _now(),
        "end_date": None,
        "status": "active",
        "transfer_reason": None,
        "transferred_from_membership_id": None,
        "transferred_to_membership_id": None,
        "transferred_to_organisation_id": None,
        "archive_reason": None,
        "is_primary": True,
        "created_at": _now(),
        "updated_at": _now(),
        "_origin_user_id": user["id"],
        "_dualwrite_marker": DUALWRITE_MARKER,
    }


def _membership_doc_from_staff(*, person_id: str, user: dict) -> dict:
    return {
        "id": _nid("m_"),
        "person_id": person_id,
        "organisation_id": user.get("tenant_id"),
        "scope_type": "staff",
        "household_id": None,
        "ward_id": None,
        "village_id": None,
        "address": None,
        "start_date": user.get("created_at") or _now(),
        "end_date": None,
        "status": "active",
        "transfer_reason": None,
        "transferred_from_membership_id": None,
        "transferred_to_membership_id": None,
        "transferred_to_organisation_id": None,
        "archive_reason": None,
        "is_primary": True,
        "created_at": _now(),
        "updated_at": _now(),
        "_origin_user_id": user["id"],
        "_dualwrite_marker": DUALWRITE_MARKER,
    }


async def _ensure_credential(db, *, person_id: str, type_: str, value: str,
                             verified_at: Optional[str] = None) -> None:
    if not value:
        return
    value = value.strip().lower() if type_ == "email" else value.strip()
    # If an ACTIVE credential of this person+type+value exists, do nothing.
    existing = await db.credentials.find_one({
        "person_id": person_id, "type": type_, "value": value, "status": "active",
    })
    if existing:
        return
    try:
        await db.credentials.insert_one({
            "id": _nid("c_"),
            "person_id": person_id,
            "type": type_, "value": value,
            "verified_at": verified_at,
            "last_used_at": None,
            "status": "active",
            "created_at": _now(),
            "_dualwrite_marker": DUALWRITE_MARKER,
        })
    except Exception as e:
        # Active unique index may reject if another Person already owns the
        # same active mobile — this means V1 has a cross-tenant duplicate
        # mobile. Log and let the parity report flag it.
        logger.warning(f"dualwrite: credential insert skipped ({type_}={value}): {e}")


# ----------------------------------------------------------------------------
# Person ensure (idempotent) for any V1 user
# ----------------------------------------------------------------------------
async def ensure_person_for_user(db, user: dict) -> Optional[str]:
    """Mirror any V1 user → Person + Credentials + (Membership if applicable).

    Idempotent. Returns the Person id, or None on failure.

    Side effects:
      - Creates Person if absent.
      - Creates a `constituency` Membership for citizens (caches on Person).
      - Creates a `staff` Membership for staff users (does NOT cache on Person
        per V2 spec: `current_organisation_id` stays null for staff).
      - Active mobile/email credentials are inserted (deduped by unique index).
      - Person audit row + (for citizens) tier1/tier2 auto consents +
        `registered` timeline event are written ONCE per user (idempotent).
    """
    if not user or not user.get("id"):
        return None
    try:
        existing = await _get_mapped_person_id(db, user["id"])
        role = user.get("role") or "citizen"
        person_type = _ROLE_TO_PERSON_TYPE.get(role, role)
        is_staff = role in STAFF_ROLES

        if existing:
            pid = existing
        else:
            pid = _nid("p_")
            person = {
                "id": pid,
                "name": user.get("name") or "Unknown",
                "dob": user.get("dob"),
                "gender": user.get("gender"),
                "email": user.get("email"),
                "photo_path": user.get("profile_photo") or user.get("photo_path"),
                "types": [person_type],
                "status": "active",
                "merged_into_person_id": None,
                "current_organisation_id": None,
                "current_membership_id": None,
                "created_at": user.get("created_at") or _now(),
                "updated_at": _now(),
                "_dualwrite_marker": DUALWRITE_MARKER,
            }
            await db.persons.insert_one(person)
            await _set_mapped_person_id(db, user["id"], pid)
            await _emit_audit(db, pid, "registered_dualwrite",
                              by_tenant_id=user.get("tenant_id"),
                              payload={"v1_user_id": user["id"], "v1_role": role})

        # Credentials (idempotent)
        if (user.get("mobile") or "").strip():
            await _ensure_credential(db, person_id=pid, type_="mobile",
                                     value=user["mobile"],
                                     verified_at=user.get("mobile_verified_at") or _now())
        if user.get("email"):
            await _ensure_credential(db, person_id=pid, type_="email",
                                     value=user["email"])

        # Membership — exactly one active per (person, org). Skip for super_admin
        # (no tenant_id) and any user whose tenant_id is missing.
        if user.get("tenant_id"):
            existing_mem = await db.memberships.find_one({
                "person_id": pid,
                "organisation_id": user["tenant_id"],
                "status": "active",
            })
            if not existing_mem:
                if is_staff:
                    mem = _membership_doc_from_staff(person_id=pid, user=user)
                else:
                    mem = _membership_doc_from_citizen(person_id=pid, user=user)
                await db.memberships.insert_one(mem)
                existing_mem = mem
                # Citizens cache current_*; staff do NOT.
                if not is_staff:
                    await db.persons.update_one(
                        {"id": pid},
                        {"$set": {
                            "current_organisation_id": mem["organisation_id"],
                            "current_membership_id": mem["id"],
                            "updated_at": _now(),
                        }},
                    )
                # Citizen auto-consents (tier1+tier2) + registered timeline
                if not is_staff:
                    for tier in ("tier1", "tier2"):
                        try:
                            await db.person_consents.insert_one({
                                "id": _nid("k_"), "person_id": pid,
                                "organisation_id": user["tenant_id"],
                                "scope": tier, "granted_at": _now(),
                                "revoked_at": None,
                                "source": "auto_on_registration",
                                "_dualwrite_marker": DUALWRITE_MARKER,
                            })
                        except Exception:
                            pass
                    await _emit_timeline(
                        db, person_id=pid,
                        organisation_id=user["tenant_id"],
                        membership_id=mem["id"],
                        event_type="registered",
                        label="Joined constituency",
                        ref_collection="memberships", ref_id=mem["id"],
                        tier="public",
                    )
                    await _emit_timeline(
                        db, person_id=pid,
                        organisation_id=user["tenant_id"],
                        membership_id=mem["id"],
                        event_type="membership_created",
                        label="Membership created",
                        ref_collection="memberships", ref_id=mem["id"],
                        tier="public",
                    )
        return pid
    except Exception:
        logger.exception(f"dualwrite: ensure_person_for_user failed for user_id={user.get('id')}")
        return None


# Backwards-compatible alias used in existing call sites.
async def sync_person_for_citizen(db, user: dict) -> Optional[str]:
    return await ensure_person_for_user(db, user)


# ----------------------------------------------------------------------------
# Active-membership resolver
# ----------------------------------------------------------------------------
async def resolve_active_membership(db, *, person_id: str,
                                    organisation_id: str) -> Optional[dict]:
    """Return the single active membership for (person, org); None if missing."""
    if not person_id or not organisation_id:
        return None
    return await db.memberships.find_one({
        "person_id": person_id,
        "organisation_id": organisation_id,
        "status": "active",
    })


async def resolve_person_and_membership(db, user: dict) -> tuple[Optional[str], Optional[str]]:
    """One-stop: ensure Person exists for this user, return (person_id, membership_id)."""
    pid = await _get_mapped_person_id(db, user["id"])
    if not pid:
        pid = await ensure_person_for_user(db, user)
    if not pid:
        return None, None
    mid = None
    if user.get("tenant_id"):
        mem = await resolve_active_membership(
            db, person_id=pid, organisation_id=user["tenant_id"])
        if not mem:
            # No membership? Mint it lazily (covers backfill misses).
            await ensure_person_for_user(db, user)
            mem = await resolve_active_membership(
                db, person_id=pid, organisation_id=user["tenant_id"])
        mid = mem["id"] if mem else None
    return pid, mid


# ----------------------------------------------------------------------------
# Profile updates
# ----------------------------------------------------------------------------
async def sync_person_profile_update(db, *, user_id: str, updates: dict,
                                     actor_user: Optional[dict] = None) -> None:
    """Mirror a `users` profile update onto the corresponding Person doc.

    The V1 PUT /api/persons/{id} endpoint accepts only profile metadata
    (occupation, notes, profile_photo, status, etc). For V2 Person we mirror:
      • profile_photo → person.photo_path
      • status='deceased' → person.status='deceased'
    Core identity fields (name/dob/gender/email/mobile) are NOT yet
    mutable via V1 and therefore intentionally excluded here.
    """
    try:
        pid = await _get_mapped_person_id(db, user_id)
        if not pid:
            return
        proj: dict = {}
        photo = updates.get("profile_photo") or updates.get("photo_path")
        if photo:
            proj["photo_path"] = photo
        # V1 user.status uses 'alive'/'deceased'; V2 Person.status accepts 'deceased'.
        u_status = updates.get("status")
        if u_status == "deceased":
            proj["status"] = "deceased"
        if not proj:
            return
        proj["updated_at"] = _now()
        await db.persons.update_one({"id": pid}, {"$set": proj})
        await _emit_timeline(
            db,
            person_id=pid,
            organisation_id=(actor_user or {}).get("tenant_id"),
            membership_id=None,
            event_type="profile_updated",
            label="Profile updated",
            summary=", ".join(k for k in proj if k != "updated_at") or None,
            tier="operational",
        )
        await _emit_audit(db, pid, "profile_updated",
                          by_user_id=(actor_user or {}).get("id"),
                          by_tenant_id=(actor_user or {}).get("tenant_id"),
                          payload=proj)
    except Exception:
        logger.exception(f"dualwrite: sync_person_profile_update failed for user_id={user_id}")


async def sync_household_update(db, *, user_id: str, household_id: Optional[str],
                                actor_user: Optional[dict]) -> None:
    """Reflect a household reassignment on the active membership + timeline."""
    try:
        pid = await _get_mapped_person_id(db, user_id)
        if not pid:
            return
        org_id = (actor_user or {}).get("tenant_id")
        mem = await resolve_active_membership(db, person_id=pid, organisation_id=org_id) if org_id else None
        if mem and mem.get("household_id") != household_id:
            await db.memberships.update_one(
                {"id": mem["id"]},
                {"$set": {"household_id": household_id, "updated_at": _now()}},
            )
            await _emit_timeline(
                db, person_id=pid, organisation_id=org_id,
                membership_id=mem["id"],
                event_type="household_changed",
                label="Household changed",
                ref_collection="households", ref_id=household_id,
                tier="public",
            )
    except Exception:
        logger.exception("dualwrite: sync_household_update failed")


# ----------------------------------------------------------------------------
# ISSUES (citizen-owned operational record)
# ----------------------------------------------------------------------------
async def sync_issue_to_v2(db, issue: dict,
                           citizen_user: Optional[dict] = None) -> None:
    """Stamp `person_id` + `origin_membership_id` on a newly-created issue and
    emit a `complaint_raised` timeline event on the citizen."""
    try:
        cid = issue.get("citizen_id")
        if not cid:
            return
        # Resolve citizen Person (lazy-create if missing — handles legacy).
        pid = await _get_mapped_person_id(db, cid)
        if not pid and citizen_user:
            pid = await ensure_person_for_user(db, citizen_user)
        if not pid:
            return
        # Resolve active membership in this tenant
        mem = await resolve_active_membership(
            db, person_id=pid, organisation_id=issue.get("tenant_id"))
        mid = mem["id"] if mem else None
        await db.issues.update_one(
            {"id": issue["id"]},
            {"$set": {
                "person_id": pid,
                "origin_membership_id": mid,
                "_dualwrite_marker": DUALWRITE_MARKER,
            }},
        )
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=issue.get("tenant_id"),
            membership_id=mid, event_type="complaint_raised",
            at=issue.get("created_at"),
            ref_collection="issues", ref_id=issue["id"],
            label=f"Complaint {issue.get('issue_code') or issue['id'][:8]}",
            summary=issue.get("title"), tier="operational",
        )
    except Exception:
        logger.exception(f"dualwrite: sync_issue_to_v2 failed for issue_id={issue.get('id')}")


_ISSUE_EVENT_MAP = {
    "Assigned": "complaint_assigned",
    "In Progress": "complaint_in_progress",
    "Resolved": "complaint_resolved",
    "Verified": "complaint_resolved",
    "Reopened": "complaint_raised",
    "Reassignment Requested": "complaint_reassigned",
    "Reassigned": "complaint_reassigned",
    "Feedback": "complaint_feedback",
}


async def sync_issue_event(db, *, issue_id: str, event_label: str,
                           note: Optional[str] = None,
                           actor_user: Optional[dict] = None) -> None:
    """Emit a timeline event on the owning citizen for an issue state change."""
    try:
        issue = await db.issues.find_one({"id": issue_id})
        if not issue:
            return
        pid = issue.get("person_id")
        if not pid and issue.get("citizen_id"):
            pid = await _get_mapped_person_id(db, issue["citizen_id"])
        if not pid:
            return
        mid = issue.get("origin_membership_id")
        ev_type = _ISSUE_EVENT_MAP.get(event_label, "complaint_assigned")
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=issue.get("tenant_id"),
            membership_id=mid, event_type=ev_type,
            ref_collection="issues", ref_id=issue_id,
            label=f"{issue.get('issue_code') or issue_id[:8]} — {event_label}",
            summary=note, tier="operational",
        )
    except Exception:
        logger.exception(f"dualwrite: sync_issue_event failed for {issue_id}")


# ----------------------------------------------------------------------------
# VISITS / NOTIFICATIONS / DEVWORKS  (staff-owned operational records)
# ----------------------------------------------------------------------------
async def _stamp_staff_owned(db, *, collection: str, doc_id: str,
                             actor_user: dict) -> tuple[Optional[str], Optional[str]]:
    pid, mid = await resolve_person_and_membership(db, actor_user)
    if not pid:
        return None, None
    try:
        await db[collection].update_one(
            {"id": doc_id},
            {"$set": {
                "person_id": pid,
                "origin_membership_id": mid,
                "_dualwrite_marker": DUALWRITE_MARKER,
            }},
        )
    except Exception:
        logger.exception(f"dualwrite: stamp on {collection}/{doc_id} failed")
    return pid, mid


async def sync_visit_to_v2(db, *, visit: dict, actor_user: dict) -> None:
    try:
        pid, mid = await _stamp_staff_owned(
            db, collection="visits", doc_id=visit["id"], actor_user=actor_user)
        if not pid:
            return
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=visit.get("tenant_id"),
            membership_id=mid, event_type="visit_announced",
            ref_collection="visits", ref_id=visit["id"],
            label=f"Visit announced: {visit.get('title')}",
            summary=f"{visit.get('visit_type')} on {visit.get('date')}",
            tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: sync_visit_to_v2 failed")


async def sync_visit_approved(db, *, visit: dict, actor_user: dict) -> None:
    try:
        pid, mid = await resolve_person_and_membership(db, actor_user)
        if not pid:
            return
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=visit.get("tenant_id"),
            membership_id=mid, event_type="visit_approved",
            ref_collection="visits", ref_id=visit["id"],
            label=f"Visit approved: {visit.get('title')}",
            tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: sync_visit_approved failed")


async def sync_notification_to_v2(db, *, notification: dict,
                                  actor_user: dict) -> None:
    try:
        pid, mid = await _stamp_staff_owned(
            db, collection="notifications", doc_id=notification["id"],
            actor_user=actor_user)
        if not pid:
            return
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=notification.get("tenant_id"),
            membership_id=mid, event_type="notification_published",
            ref_collection="notifications", ref_id=notification["id"],
            label=f"Notification: {notification.get('title')}",
            summary=notification.get("body"), tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: sync_notification_to_v2 failed")


async def sync_devwork_to_v2(db, *, devwork: dict, actor_user: dict) -> None:
    try:
        pid, mid = await _stamp_staff_owned(
            db, collection="devworks", doc_id=devwork["id"], actor_user=actor_user)
        if not pid:
            return
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=devwork.get("tenant_id"),
            membership_id=mid, event_type="devwork_announced",
            ref_collection="devworks", ref_id=devwork["id"],
            label=f"DevWork announced: {devwork.get('title')}",
            summary=devwork.get("category"), tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: sync_devwork_to_v2 failed")


async def sync_devwork_status(db, *, devwork: dict, status: str,
                              actor_user: dict) -> None:
    if status != "Completed":
        return
    try:
        pid, mid = await resolve_person_and_membership(db, actor_user)
        if not pid:
            return
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=devwork.get("tenant_id"),
            membership_id=mid, event_type="devwork_completed",
            ref_collection="devworks", ref_id=devwork["id"],
            label=f"DevWork completed: {devwork.get('title')}",
            tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: sync_devwork_status failed")


# ----------------------------------------------------------------------------
# INTERACTIONS (staff-logged service event for a subject citizen)
# ----------------------------------------------------------------------------
async def sync_interaction_to_v2(db, *, interaction: dict,
                                 subject_user: Optional[dict] = None,
                                 actor_user: Optional[dict] = None) -> None:
    try:
        subj_user_id = interaction.get("person_id")  # legacy V1 stored user_id here
        pid = await _get_mapped_person_id(db, subj_user_id) if subj_user_id else None
        if not pid and subject_user:
            pid = await ensure_person_for_user(db, subject_user)
        if not pid:
            return
        mem = await resolve_active_membership(
            db, person_id=pid, organisation_id=interaction.get("tenant_id"))
        mid = mem["id"] if mem else None
        await db.interactions.update_one(
            {"id": interaction["id"]},
            {"$set": {
                "person_id": pid,
                "origin_membership_id": mid,
                "_dualwrite_marker": DUALWRITE_MARKER,
            }},
        )
        await _emit_timeline(
            db, person_id=pid,
            organisation_id=interaction.get("tenant_id"),
            membership_id=mid, event_type="interaction_logged",
            ref_collection="interactions", ref_id=interaction["id"],
            label=f"{interaction.get('interaction_type') or 'Interaction'}",
            summary=interaction.get("description"),
            tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: sync_interaction_to_v2 failed")


# ----------------------------------------------------------------------------
# RELATIONSHIPS (mirror to relationships_v2 GLOBAL collection)
# ----------------------------------------------------------------------------
async def sync_relationship_to_v2(db, *, rel: dict, actor_user: dict) -> None:
    try:
        from_pid = await _get_mapped_person_id(db, rel["person_a"])
        to_pid = await _get_mapped_person_id(db, rel["person_b"])
        if not from_pid or not to_pid:
            return
        # Stamp origin_membership_id on V1 row for parity tracking.
        actor_pid, actor_mid = await resolve_person_and_membership(db, actor_user)
        if actor_mid:
            await db.relationships.update_one(
                {"id": rel["id"]},
                {"$set": {"origin_membership_id": actor_mid,
                          "_dualwrite_marker": DUALWRITE_MARKER}},
            )
        existing = await db.relationships_v2.find_one({
            "from_person_id": from_pid, "to_person_id": to_pid,
            "type": rel["type"], "status": "active",
        })
        if existing:
            return
        v2 = {
            "id": _nid("rel_"),
            "from_person_id": from_pid,
            "to_person_id": to_pid,
            "type": rel["type"],
            "since_date": rel.get("since"),
            "until_date": None,
            "status": "active",
            "notes": rel.get("notes"),
            "created_at": rel.get("created_at") or _now(),
            "created_by_person_id": actor_pid,
            "_v1_relationship_id": rel["id"],
            "_dualwrite_marker": DUALWRITE_MARKER,
        }
        await db.relationships_v2.insert_one(v2)
        await _emit_timeline(
            db, person_id=from_pid,
            organisation_id=(actor_user or {}).get("tenant_id"),
            membership_id=actor_mid,
            event_type="relationship_added",
            label=f"Relationship added: {rel['type']}",
            ref_collection="relationships_v2", ref_id=v2["id"],
            tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: sync_relationship_to_v2 failed")


async def revoke_relationship_v2(db, *, rel_id: str,
                                 actor_user: Optional[dict] = None) -> None:
    try:
        v2 = await db.relationships_v2.find_one({"_v1_relationship_id": rel_id})
        if not v2:
            return
        await db.relationships_v2.update_one(
            {"id": v2["id"]},
            {"$set": {"status": "ended", "until_date": _now()}},
        )
        actor_pid, actor_mid = (None, None)
        if actor_user:
            actor_pid, actor_mid = await resolve_person_and_membership(db, actor_user)
        await _emit_timeline(
            db, person_id=v2["from_person_id"],
            organisation_id=(actor_user or {}).get("tenant_id"),
            membership_id=actor_mid,
            event_type="relationship_removed",
            label=f"Relationship removed: {v2['type']}",
            ref_collection="relationships_v2", ref_id=v2["id"],
            tier="operational",
        )
    except Exception:
        logger.exception("dualwrite: revoke_relationship_v2 failed")


# ----------------------------------------------------------------------------
# PARITY CHECKER (M3 deliverable)
# ----------------------------------------------------------------------------
async def parity_report(db) -> dict:
    """Comprehensive V1↔V2 parity assertion. Each check has `ok=true` when no
    deviation is detected. The report is JSON-serialisable for the API.

    Invariants:
        I1. Every V1 citizen has exactly one mapped Person.
        I2. Every active mobile credential belongs to exactly one Person.
        I3. Every citizen Person has exactly one ACTIVE Membership.
        I4. No orphan Memberships (Person must exist & not be merged).
        I5. No orphan Timeline Events (Person must exist).
        I6. No orphan Persons (citizen Persons must have at least one membership;
            this is relaxed for "merged" or "deceased" Persons).
        I7. Every Issue / Visit / Notification / DevWork / Interaction /
            Relationship (V1) has `person_id`.
        I8. Every operational record has `origin_membership_id`.
    """
    checks: dict[str, dict] = {}

    # ---------- I1: citizens have exactly one Person ----------
    citizens = await db.users.count_documents({"role": "citizen"})
    # Count citizen IDs that DO have a mapping row.
    cit_ids: list[str] = [u["id"] async for u in
                          db.users.find({"role": "citizen"}, projection={"id": 1, "_id": 0})]
    mapped = await db["_v2_user_to_person"].count_documents(
        {"_id": {"$in": cit_ids}}) if cit_ids else 0
    persons_for_citizens = await db.persons.count_documents({"types": "citizen"})
    checks["I1_citizens_mapped"] = {
        "v1": citizens, "v2_mapped": mapped, "v2_persons": persons_for_citizens,
        "delta": citizens - mapped,
        "ok": (citizens - mapped == 0),
    }

    # ---------- I2: active mobile credentials unique per person ----------
    dup_mobiles = []
    pipeline_dup_mobile = [
        {"$match": {"type": "mobile", "status": "active"}},
        {"$group": {"_id": "$value", "n": {"$sum": 1}, "persons": {"$addToSet": "$person_id"}}},
        {"$match": {"n": {"$gt": 1}}},
        {"$limit": 50},
    ]
    async for row in db.credentials.aggregate(pipeline_dup_mobile):
        dup_mobiles.append({"value": row["_id"], "count": row["n"],
                            "persons": row["persons"][:10]})
    checks["I2_mobile_unique_active"] = {
        "duplicates": dup_mobiles,
        "delta": len(dup_mobiles),
        "ok": len(dup_mobiles) == 0,
    }

    # ---------- I3: each citizen person has exactly one active membership ----------
    missing_mem = 0
    multi_mem = 0
    sample_missing: list[str] = []
    sample_multi: list[str] = []
    pipeline_mem = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$person_id", "n": {"$sum": 1}}},
    ]
    by_person: dict[str, int] = {}
    async for row in db.memberships.aggregate(pipeline_mem):
        by_person[row["_id"]] = row["n"]
    async for p in db.persons.find(
        {"types": "citizen", "status": "active"},
        projection={"id": 1, "_id": 0},
    ):
        n = by_person.get(p["id"], 0)
        if n == 0:
            missing_mem += 1
            if len(sample_missing) < 10:
                sample_missing.append(p["id"])
        elif n > 1:
            multi_mem += 1
            if len(sample_multi) < 10:
                sample_multi.append(p["id"])
    checks["I3_citizen_one_active_membership"] = {
        "missing": missing_mem, "multi": multi_mem,
        "sample_missing": sample_missing, "sample_multi": sample_multi,
        "delta": missing_mem + multi_mem,
        "ok": (missing_mem + multi_mem) == 0,
    }

    # ---------- I4: no orphan memberships (Person must exist & be active) ----------
    orphan_mem = 0
    sample_orphan_mem: list[str] = []
    person_ids: set[str] = set()
    async for p in db.persons.find({}, projection={"id": 1, "_id": 0}):
        person_ids.add(p["id"])
    async for m in db.memberships.find({}, projection={"id": 1, "person_id": 1, "_id": 0}):
        if m["person_id"] not in person_ids:
            orphan_mem += 1
            if len(sample_orphan_mem) < 10:
                sample_orphan_mem.append(m["id"])
    checks["I4_no_orphan_memberships"] = {
        "delta": orphan_mem, "sample": sample_orphan_mem,
        "ok": orphan_mem == 0,
    }

    # ---------- I5: no orphan timeline events ----------
    orphan_tl = 0
    sample_orphan_tl: list[str] = []
    async for t in db.person_timeline_events.find(
        {}, projection={"id": 1, "person_id": 1, "_id": 0},
    ):
        if t["person_id"] not in person_ids:
            orphan_tl += 1
            if len(sample_orphan_tl) < 10:
                sample_orphan_tl.append(t["id"])
    checks["I5_no_orphan_timeline_events"] = {
        "delta": orphan_tl, "sample": sample_orphan_tl,
        "ok": orphan_tl == 0,
    }

    # ---------- I6: every active citizen Person has a Membership ----------
    # Already captured by I3 (missing>0). Counted separately for clarity.
    checks["I6_no_orphan_citizen_persons"] = {
        "delta": checks["I3_citizen_one_active_membership"]["missing"],
        "ok": checks["I3_citizen_one_active_membership"]["missing"] == 0,
    }

    # ---------- I7: operational records have person_id ----------
    for col in ("issues", "visits", "notifications", "devworks",
                "interactions", "relationships"):
        total = await db[col].count_documents({})
        stamped = await db[col].count_documents(
            {"person_id": {"$exists": True, "$ne": None}})
        # relationships is a special case — relationship.person_a/person_b are
        # already V1 user_ids, but we mirror to relationships_v2 (separate
        # collection). For relationships we instead verify mirror count.
        if col == "relationships":
            mirrored = await db.relationships_v2.count_documents({})
            checks[f"I7_{col}_mirrored"] = {
                "v1": total, "v2": mirrored, "delta": total - mirrored,
                "ok": (total - mirrored == 0),
            }
            continue
        checks[f"I7_{col}_have_person_id"] = {
            "total": total, "stamped": stamped,
            "delta": total - stamped, "ok": (total - stamped == 0),
        }

    # ---------- I8: every operational record has origin_membership_id ----------
    for col in ("issues", "visits", "notifications", "devworks",
                "interactions"):
        total = await db[col].count_documents({})
        stamped = await db[col].count_documents(
            {"origin_membership_id": {"$exists": True, "$ne": None}})
        checks[f"I8_{col}_have_origin_membership"] = {
            "total": total, "stamped": stamped,
            "delta": total - stamped, "ok": (total - stamped == 0),
        }

    report = {
        "computed_at": _now(),
        "checks": checks,
        "ok": all(c["ok"] for c in checks.values()),
    }
    return report
