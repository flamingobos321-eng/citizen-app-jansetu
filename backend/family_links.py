"""Tenant-safe citizen family links backed by the global V2 relationship graph."""
from __future__ import annotations

import uuid
from typing import Any

import v2_dualwrite as v2dw
from models import inverse_relation, now_iso


def _edge_key(person_id: str | None, user_id: str | None, relation: str) -> tuple[str, str]:
    return (person_id or user_id or "", relation.casefold())


async def _person_ids_for_users(db, user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    rows = await db["_v2_user_to_person"].find(
        {"_id": {"$in": user_ids}}, {"_id": 1, "person_id": 1}
    ).to_list(len(user_ids))
    return {row["_id"]: row["person_id"] for row in rows if row.get("person_id")}


async def _active_user_for_person(db, person_id: str) -> dict | None:
    mapping_rows = await db["_v2_user_to_person"].find(
        {"person_id": person_id}, {"_id": 1}
    ).to_list(20)
    user_ids = [row["_id"] for row in mapping_rows]
    person = await db.persons.find_one(
        {"id": person_id}, {"_id": 0, "current_organisation_id": 1}
    )
    query = {
        "role": "citizen",
        "is_active": {"$ne": False},
        "$or": [
            {"person_id": person_id},
            {"id": {"$in": user_ids}},
        ],
    }
    candidates = await db.users.find(
        query,
        {
            "_id": 0, "id": 1, "person_id": 1, "tenant_id": 1,
            "name": 1, "mobile": 1, "gender": 1,
        },
    ).to_list(20)
    preferred_org = (person or {}).get("current_organisation_id")
    return next(
        (row for row in candidates if row.get("tenant_id") == preferred_org),
        candidates[0] if candidates else None,
    )


async def list_family_members(db, user: dict) -> list[dict[str, Any]]:
    """List only basic contact details for relatives linked to this Person.

    V2 relationships are global so a family edge remains visible after either
    person changes constituency. Legacy V1 edges remain visible in their
    original tenant while older records are being migrated.
    """
    if user.get("role") != "citizen":
        raise ValueError("Citizens only")

    person_id = user.get("person_id") or await v2dw.ensure_person_for_user(db, user)
    if not person_id:
        return []

    tenant_id = user.get("tenant_id")
    edges: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    global_edges = await db.relationships_v2.find(
        {
            "status": "active",
            "$or": [
                {"from_person_id": person_id},
                {"to_person_id": person_id},
            ],
        },
        {"_id": 0},
    ).to_list(1000)
    for edge in global_edges:
        is_from = edge.get("from_person_id") == person_id
        other_person_id = edge.get("to_person_id") if is_from else edge.get("from_person_id")
        if not other_person_id or other_person_id == person_id:
            continue
        relation = (
            edge.get("type", "Other")
            if is_from
            else inverse_relation(edge.get("type", "Other"), user.get("gender"))
        )
        key = _edge_key(other_person_id, None, relation)
        if key in seen:
            continue
        seen.add(key)
        edges.append({
            "id": edge["id"],
            "other_person_id": other_person_id,
            "other_user_id": None,
            "relation": relation,
            "created_at": edge.get("created_at"),
        })

    # Keep legacy relationships available only to their own constituency.
    # Skip rows already mirrored into the global graph.
    legacy = await db.relationships.find(
        {
            "tenant_id": tenant_id,
            "$or": [{"person_a": user["id"]}, {"person_b": user["id"]}],
        },
        {"_id": 0},
    ).to_list(500)
    legacy_other_ids = list({
        edge["person_b"] if edge.get("person_a") == user["id"] else edge["person_a"]
        for edge in legacy
    })
    legacy_users: dict[str, dict] = {}
    if legacy_other_ids:
        rows = await db.users.find(
            {"tenant_id": tenant_id, "id": {"$in": legacy_other_ids}},
            {"_id": 0, "id": 1, "person_id": 1},
        ).to_list(len(legacy_other_ids))
        legacy_users = {row["id"]: row for row in rows}
    legacy_person_ids = await _person_ids_for_users(db, legacy_other_ids)
    for edge in legacy:
        is_a = edge.get("person_a") == user["id"]
        other_user_id = edge.get("person_b") if is_a else edge.get("person_a")
        other_person_id = (
            legacy_users.get(other_user_id, {}).get("person_id")
            or legacy_person_ids.get(other_user_id)
        )
        relation = (
            edge.get("type", "Other")
            if is_a
            else inverse_relation(edge.get("type", "Other"), user.get("gender"))
        )
        key = _edge_key(other_person_id, other_user_id, relation)
        if key in seen:
            continue
        seen.add(key)
        edges.append({
            "id": edge["id"],
            "other_person_id": other_person_id,
            "other_user_id": other_user_id,
            "relation": relation,
            "created_at": edge.get("created_at"),
        })

    other_person_ids = list({
        edge["other_person_id"] for edge in edges if edge.get("other_person_id")
    })
    other_user_ids = list({
        edge["other_user_id"] for edge in edges if edge.get("other_user_id")
    })

    person_org: dict[str, str] = {}
    people_by_id: dict[str, dict] = {}
    if other_person_ids:
        people = await db.persons.find(
            {"id": {"$in": other_person_ids}},
            {"_id": 0, "id": 1, "name": 1, "gender": 1, "current_organisation_id": 1},
        ).to_list(len(other_person_ids))
        people_by_id = {person["id"]: person for person in people}
        person_org = {
            person["id"]: person["current_organisation_id"]
            for person in people
            if person.get("current_organisation_id")
        }

    mapped_user_ids = await _person_ids_for_users(
        db,
        list({
            mapping["_id"]
            async for mapping in db["_v2_user_to_person"].find(
                {"person_id": {"$in": other_person_ids}},
                {"_id": 1},
            )
        }),
    ) if other_person_ids else {}
    candidate_user_ids = list(set(other_user_ids) | set(mapped_user_ids))
    candidate_users: dict[str, dict] = {}
    user_by_person: dict[str, dict] = {}
    if candidate_user_ids:
        rows = await db.users.find(
            {
                "role": "citizen",
                "is_active": {"$ne": False},
                "$or": [
                    {"id": {"$in": candidate_user_ids}},
                    {"person_id": {"$in": other_person_ids}},
                ],
            },
            {
                "_id": 0, "id": 1, "person_id": 1, "tenant_id": 1,
                "name": 1, "mobile": 1, "gender": 1,
            },
        ).to_list(len(candidate_user_ids))
        candidate_users = {row["id"]: row for row in rows}
        mapped_to_pid = {user_id: pid for user_id, pid in mapped_user_ids.items()}
        for row in rows:
            pid = row.get("person_id") or mapped_to_pid.get(row["id"])
            if not pid:
                continue
            preferred_tenant = person_org.get(pid)
            current = user_by_person.get(pid)
            if current is None or row.get("tenant_id") == preferred_tenant:
                user_by_person[pid] = row

    constituency_names: dict[str, str] = {}
    other_tenants = list({
        (user_by_person.get(pid) or candidate_users.get(uid) or {}).get("tenant_id")
        for pid, uid in (
            (edge.get("other_person_id"), edge.get("other_user_id"))
            for edge in edges
        )
        if (user_by_person.get(pid) or candidate_users.get(uid) or {}).get("tenant_id")
    })
    if other_tenants:
        portals = await db.portal_configs.find(
            {"id": {"$in": other_tenants}},
            {"_id": 0, "id": 1, "constituency_name": 1, "tenant_name": 1},
        ).to_list(len(other_tenants))
        constituency_names = {
            portal["id"]: portal.get("constituency_name") or portal.get("tenant_name") or ""
            for portal in portals
        }

    result: list[dict[str, Any]] = []
    for edge in edges:
        other_person_id = edge.get("other_person_id")
        other_user_id = edge.get("other_user_id")
        other = (
            user_by_person.get(other_person_id)
            if other_person_id
            else candidate_users.get(other_user_id)
        )
        person = people_by_id.get(other_person_id) or {}
        other_tenant_id = (other or {}).get("tenant_id")
        result.append({
            "id": edge["id"],
            "other_name": (other or {}).get("name") or person.get("name"),
            "other_mobile": (other or {}).get("mobile"),
            "other_constituency": constituency_names.get(other_tenant_id),
            "cross_constituency": bool(other_tenant_id and other_tenant_id != tenant_id),
            "relation": edge["relation"],
        })
    result.sort(key=lambda row: ((row.get("relation") or ""), (row.get("other_name") or "")))
    return result


async def accept_family_invitation(db, invitation_id: str, user: dict) -> dict[str, Any]:
    if user.get("role") != "citizen":
        raise ValueError("Only citizens can accept family invitations")
    invitation = await db.family_invitations.find_one(
        {"id": invitation_id, "status": "pending"}, {"_id": 0}
    )
    if not invitation:
        raise LookupError("Invitation not found or already resolved")
    if (user.get("mobile") or "") != invitation.get("target_mobile"):
        raise PermissionError("This invitation is for a different mobile")

    sender = await db.users.find_one(
        {"id": invitation.get("from_user_id"), "role": "citizen"},
        {"_id": 0},
    )
    if not sender:
        raise LookupError("The inviting account is no longer available")
    sender_person_id = invitation.get("from_person_id") or await v2dw.ensure_person_for_user(db, sender)
    recipient_person_id = user.get("person_id") or await v2dw.ensure_person_for_user(db, user)
    if not sender_person_id or not recipient_person_id:
        raise ValueError("Could not resolve both citizen accounts")
    if sender_person_id == recipient_person_id:
        raise ValueError("You cannot link your account to itself")
    active_sender = await _active_user_for_person(db, sender_person_id) or sender
    sender_tenant_id = active_sender.get("tenant_id") or invitation.get("tenant_id")
    cross_constituency = sender_tenant_id != user.get("tenant_id")

    invitation_edge = await db.relationships_v2.find_one(
        {"_family_invitation_id": invitation_id, "status": "active"},
        {"_id": 0},
    )
    if invitation_edge:
        linked_person_ids = {
            invitation_edge.get("from_person_id"),
            invitation_edge.get("to_person_id"),
        }
        if recipient_person_id not in linked_person_ids:
            raise ValueError("This invitation was accepted by another account")
        relationship_id = invitation_edge["id"]
        await db.family_invitations.update_one(
            {"id": invitation_id, "status": "pending"},
            {"$set": {
                "status": "linked",
                "resolved_user_id": user["id"],
                "resolved_person_id": recipient_person_id,
                "relationship_id": relationship_id,
                "resolved_at": now_iso(),
            }},
        )
        return {
            "relationship_id": relationship_id,
            "cross_constituency": cross_constituency,
        }

    existing = await db.relationships_v2.find_one(
        {
            "status": "active",
            "$or": [
                {"from_person_id": sender_person_id, "to_person_id": recipient_person_id},
                {"from_person_id": recipient_person_id, "to_person_id": sender_person_id},
            ],
        },
        {"_id": 0},
    )
    relationship_id: str
    if existing:
        relationship_id = existing["id"]
    elif cross_constituency:
        relationship_id = f"rel_fam_{invitation_id}"
        await db.relationships_v2.insert_one({
            "id": relationship_id,
            "from_person_id": sender_person_id,
            "to_person_id": recipient_person_id,
            "type": invitation["relation_type"],
            "since_date": None,
            "until_date": None,
            "status": "active",
            "notes": None,
            "created_at": now_iso(),
            "created_by_person_id": sender_person_id,
            "accepted_by_person_id": recipient_person_id,
            "_family_invitation_id": invitation_id,
        })
    else:
        relationship_id = f"rel_fam_{invitation_id}"
        already_created = await db.relationships.find_one(
            {"id": relationship_id}, {"_id": 0}
        )
        if already_created:
            mirrored = await db.relationships_v2.find_one(
                {"_v1_relationship_id": relationship_id}, {"_id": 0, "id": 1}
            )
            if mirrored:
                relationship_id = mirrored["id"]
            else:
                relationship_id = already_created["id"]
        else:
            relationship = {
                "id": relationship_id,
                "tenant_id": sender_tenant_id,
                "person_a": active_sender["id"],
                "person_b": user["id"],
                "type": invitation["relation_type"],
                "created_at": now_iso(),
            }
            await db.relationships.insert_one(relationship)
            await v2dw.sync_relationship_to_v2(db, rel=relationship, actor_user=active_sender)
            mirrored = await db.relationships_v2.find_one(
                {"_v1_relationship_id": relationship_id}, {"_id": 0, "id": 1}
            )
            if mirrored:
                relationship_id = mirrored["id"]

        if invitation["relation_type"] in ("Husband", "Wife") and invitation.get("marriage_anniversary"):
            await db.users.update_many(
                {
                    "tenant_id": sender_tenant_id,
                    "id": {"$in": [active_sender["id"], user["id"]]},
                },
                {"$set": {"marriage_anniversary": invitation["marriage_anniversary"]}},
            )

    await db.family_invitations.update_one(
        {"id": invitation_id, "status": "pending"},
        {"$set": {
            "status": "linked",
            "resolved_user_id": user["id"],
            "resolved_person_id": recipient_person_id,
            "relationship_id": relationship_id,
            "resolved_at": now_iso(),
        }},
    )
    return {
        "relationship_id": relationship_id,
        "cross_constituency": cross_constituency,
    }


async def remove_family_relationship(db, relationship_id: str, user: dict) -> bool:
    if user.get("role") != "citizen":
        raise ValueError("Only citizens can remove family links")
    person_id = user.get("person_id") or await v2dw.ensure_person_for_user(db, user)
    if not person_id:
        return False

    relation = await db.relationships_v2.find_one(
        {
            "id": relationship_id,
            "status": "active",
            "$or": [
                {"from_person_id": person_id},
                {"to_person_id": person_id},
            ],
        },
        {"_id": 0},
    )
    if relation:
        await db.relationships_v2.update_one(
            {"id": relationship_id, "status": "active"},
            {"$set": {
                "status": "ended",
                "until_date": now_iso(),
                "ended_by_person_id": person_id,
            }},
        )
        v1_id = relation.get("_v1_relationship_id")
        if v1_id:
            await db.relationships.delete_one({"id": v1_id})
        return True

    legacy = await db.relationships.find_one(
        {
            "id": relationship_id,
            "tenant_id": user.get("tenant_id"),
            "$or": [{"person_a": user["id"]}, {"person_b": user["id"]}],
        },
        {"_id": 0},
    )
    if not legacy:
        return False
    await db.relationships.delete_one({
        "id": relationship_id,
        "tenant_id": user.get("tenant_id"),
    })
    await v2dw.revoke_relationship_v2(db, rel_id=relationship_id, actor_user=user)
    return True
