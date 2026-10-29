"""V2 visibility & write-guard helpers.

Amendment 1.1 visibility rule (canonical, enforce uniformly):

  Tenant T may READ an operational record R (issue / visit / devwork / interaction)
  iff R.origin_membership_id belongs to some membership of T.

  Tenant T may WRITE an operational record for Person P
  iff P has an ACTIVE membership in T.

  Citizen C (self) may READ all rows where person_id == C.person_id.
  Super admin reads everything.

Behaviour after a constituency transfer is therefore automatic:
  • Records created BEFORE transfer have origin_membership_id pointing to
    the old (now-archived) membership in the old tenant → visible to old tenant.
  • Records created AFTER transfer have origin_membership_id pointing to
    the new active membership in the new tenant → invisible to old tenant.
  • Old tenant becomes read-only because no ACTIVE membership exists there
    for that Person any more → assert_active_membership() raises 403.

This module is import-safe at startup and does not require V2 data to exist.
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException


async def assert_active_membership(db, *, person_id: str,
                                   organisation_id: str) -> dict:
    """WRITE GUARD: refuse if Person has no active membership in this tenant."""
    m = await db.memberships.find_one({
        "person_id": person_id,
        "organisation_id": organisation_id,
        "status": "active",
    })
    if not m:
        raise HTTPException(
            403,
            "This citizen is no longer active in your constituency. "
            "Their record is read-only.",
        )
    return m


async def visibility_filter_for_tenant(db, *, organisation_id: str) -> dict:
    """READ GUARD: produces a Mongo `$or` clause restricting operational reads
    to records whose `origin_membership_id` belongs to a membership of this
    tenant.

    Backward-compatible fallback: rows without `origin_membership_id` (legacy
    V1 data created before stamping) fall back to `tenant_id == organisation_id`.
    """
    mem_ids: list[str] = []
    async for m in db.memberships.find(
        {"organisation_id": organisation_id},
        projection={"id": 1, "_id": 0},
    ):
        mem_ids.append(m["id"])
    return {
        "$or": [
            {"origin_membership_id": {"$in": mem_ids}},
            # Fallback for not-yet-stamped legacy rows: same-tenant_id read
            {"$and": [
                {"tenant_id": organisation_id},
                {"$or": [{"origin_membership_id": None},
                         {"origin_membership_id": {"$exists": False}}]},
            ]},
        ]
    }


async def membership_for_person_in_tenant(
    db, *, person_id: str, organisation_id: str
) -> Optional[dict]:
    """Return any membership (active or archived) of person in tenant, or None.
    Used to gate READ access to person profile / lifetime list per the
    visibility rule (tenant sees a Person only if they belonged here at some
    point)."""
    return await db.memberships.find_one({
        "person_id": person_id,
        "organisation_id": organisation_id,
    })
