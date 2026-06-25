"""M2 — V1 → V2 Backfill Engine.

Idempotent migration that promotes every V1 citizen `users` row into the V2
identity model:

    users.citizen  →  persons + credentials + memberships
    issues.citizen_id     →  issues.person_id  (stamped)
    interactions.person_id (legacy: was user_id) → corrected to V2 person_id
    relationships (V1)    →  relationships_v2  (with from/to_person_id)

Design contract
---------------
1. Idempotent  — re-runnable any number of times; no duplicates created.
                 An anchor collection `_v2_user_to_person` maps user_id →
                 person_id. Lookups always go through this map first.

2. Run-tagged  — every row M2 creates carries a `_migration_run_id`. Rollback
                 deletes by that tag; older runs survive.

3. Reversible  — `--rollback <run_id>` undoes every change made by a single
                 run (Persons, Credentials, Memberships, audit, mappings, and
                 the person_id field on operational records).

4. Validated   — `--commit` runs validation gates after writes. On failure the
                 entire run is rolled back and the process exits non-zero.

5. V1-safe     — the migration only WRITES new V2 rows. The only V1 fields it
                 touches are nullable additions (`issues.person_id`,
                 `interactions.person_id` correction). V1 reads continue to
                 work because the legacy fields (`citizen_id`, etc.) are
                 never removed.

Usage
-----
    cd /app/backend
    python -m migrations.m2_backfill --dry-run
    python -m migrations.m2_backfill --commit
    python -m migrations.m2_backfill --commit --dedupe-csv /app/migrations/dedupe_20260625.csv
    python -m migrations.m2_backfill --rollback <run_id>
    python -m migrations.m2_backfill --report-only <run_id>          # print past run
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import sys
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

REPORT_DIR = Path("/app/migrations")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str = "") -> str:
    """Match the shape of V1 ids (prefixes are cosmetic only)."""
    return (prefix + str(uuid.uuid4())) if prefix else str(uuid.uuid4())


# ============================================================================
#                        CSV DEDUPE DECISION PARSING
# ============================================================================

def load_dedupe_decisions(csv_path: Path | None) -> dict[str, dict]:
    """Return { mobile: { 'decision': 'MERGE'|'KEEP_SEPARATE', 'user_ids': [...] } }

    If the CSV has any REVIEW_* row with a blank `decision`, raise.
    """
    out: dict[str, dict] = {}
    if not csv_path:
        return out
    if not csv_path.exists():
        raise FileNotFoundError(f"Dedupe CSV not found: {csv_path}")

    def _decision_of(row: dict) -> str:
        """Tolerate either header form: `decision` or
        `decision (MERGE | KEEP_SEPARATE | leave blank)`."""
        for k, v in row.items():
            if k and k.strip().lower().startswith("decision"):
                return (v or "").strip().upper()
        return ""

    with csv_path.open() as f:
        reader = csv.DictReader(f)
        rows_by_mobile = defaultdict(list)
        for row in reader:
            mobile = (row.get("mobile") or "").strip()
            if not mobile:
                continue
            rows_by_mobile[mobile].append(row)

    blank_rows: list[str] = []
    for mobile, rows in rows_by_mobile.items():
        decisions = {_decision_of(r) for r in rows if r}
        decisions.discard("")
        classification = rows[0].get("classification", "")
        if classification.startswith("AUTO_") and not decisions:
            decisions = {"MERGE"}
        if not decisions:
            blank_rows.append(f"{mobile}: classification={classification} has blank decision")
            continue
        if decisions == {"MERGE"} or decisions == {"KEEP_SEPARATE"}:
            out[mobile] = {
                "decision": decisions.pop(),
                "user_ids": [r.get("user_id") for r in rows if r.get("user_id")],
            }
        else:
            blank_rows.append(f"{mobile}: inconsistent decisions {decisions}")
    if blank_rows:
        raise ValueError("Dedupe decisions incomplete or inconsistent:\n  " + "\n  ".join(blank_rows))
    return out


# ============================================================================
#                        BACKFILL ENGINE
# ============================================================================

class Backfill:
    def __init__(self, db: AsyncIOMotorDatabase, *, dry_run: bool, dedupe: dict[str, dict]):
        self.db = db
        self.dry_run = dry_run
        self.dedupe = dedupe
        self.run_id = "run_" + str(uuid.uuid4())[:8] + "_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        self.started_at = now_iso()
        # Per-run counters for the audit report
        self.counts: dict[str, int] = defaultdict(int)
        self.errors: list[str] = []
        # Conflict tracking
        self.conflict_mobiles: list[str] = []

    # --- persistence helpers (no-ops when dry-run) ---
    async def _insert(self, coll: str, doc: dict) -> None:
        doc["_migration_run_id"] = self.run_id
        if self.dry_run:
            return
        await self.db[coll].insert_one(doc)

    async def _update(self, coll: str, filt: dict, update: dict) -> int:
        if self.dry_run:
            n = await self.db[coll].count_documents(filt)
            return n
        res = await self.db[coll].update_many(filt, update)
        return res.modified_count

    async def _upsert_map(self, user_id: str, person_id: str) -> None:
        if self.dry_run:
            return
        await self.db["_v2_user_to_person"].update_one(
            {"_id": user_id},
            {"$set": {"_id": user_id, "person_id": person_id,
                      "_migration_run_id": self.run_id, "at": now_iso()}},
            upsert=True,
        )

    # --- lookups ---
    async def _existing_person_for_user(self, user_id: str) -> str | None:
        m = await self.db["_v2_user_to_person"].find_one({"_id": user_id})
        return m["person_id"] if m else None

    # ----------------------------------------------------------------
    #                        PHASE A — Persons + Credentials
    # ----------------------------------------------------------------
    async def phase_persons(self) -> None:
        """For every V1 user (citizen AND staff), ensure a Person + credential.

        Per V2 spec D2 (`Person` is the universal core entity, not just
        Citizen), staff users — politicians, PAs, workers, tenant admins —
        also become Persons.  Their `types[]` reflects their role, and their
        email becomes their primary credential.

        Honour dedupe decisions for citizens with duplicate mobiles.
        """
        # Citizens are processed by mobile (deduped); staff are processed
        # individually because their primary credential is email.
        cit_cursor = self.db.users.find({"role": "citizen"}, projection={"_id": 0})
        users_by_mobile: dict[str, list[dict]] = defaultdict(list)
        users_without_mobile: list[dict] = []
        async for u in cit_cursor:
            self.counts["citizens_scanned"] += 1
            mob = (u.get("mobile") or "").strip()
            (users_by_mobile[mob] if mob else users_without_mobile).append(u)

        # ----- citizens with mobile -----
        for mobile, users in users_by_mobile.items():
            users_sorted = sorted(users, key=lambda x: x.get("created_at") or "")
            decision = self.dedupe.get(mobile, {}).get("decision")

            # No duplicate? single trivial path.
            if len(users) == 1:
                await self._link_user_to_new_person(users[0], make_mobile_active=True)
                continue

            # Duplicate but no decision provided → conflict; abort.
            if decision is None:
                self.conflict_mobiles.append(mobile)
                continue

            if decision == "MERGE":
                # one Person; multiple Memberships (older = archived, newest = active)
                existing = await self._existing_person_for_user(users_sorted[-1]["id"])
                person_id = existing or await self._create_person(users_sorted[-1])
                for u in users_sorted:
                    await self._upsert_map(u["id"], person_id)
                # Single mobile credential — bind to the merged person.
                await self._ensure_mobile_credential(person_id, mobile, status="active",
                                                    verified_at=users_sorted[-1].get("mobile_verified_at"))
                # email creds (each user may have a distinct email — all attach to same person)
                for u in users_sorted:
                    if u.get("email"):
                        await self._ensure_email_credential(person_id, u["email"], status="active")
            else:  # KEEP_SEPARATE
                # Each user → its own Person. Most recent keeps active mobile.
                for i, u in enumerate(users_sorted):
                    is_newest = (i == len(users_sorted) - 1)
                    pid = await self._link_user_to_new_person(
                        u, make_mobile_active=is_newest,
                        mobile_value=mobile,
                    )
                    if not is_newest:
                        # older user keeps a 'revoked' mobile credential as a stub
                        await self._ensure_mobile_credential(pid, mobile, status="revoked",
                                                             verified_at=u.get("mobile_verified_at"))

        # ----- citizens without mobile -----
        for u in users_without_mobile:
            await self._link_user_to_new_person(u, make_mobile_active=False)

        # ----- staff users (politicians, PAs, workers, admins) -----
        # Each becomes a Person with the appropriate `types`.  Their email
        # becomes an active email credential; mobile (if set) becomes an
        # active mobile credential.  No Membership is created — staff do not
        # need constituency membership; they are tied to their org via the
        # original `users.tenant_id` (still used by auth).
        staff_cursor = self.db.users.find(
            {"role": {"$in": ["worker", "pa", "politician", "admin", "super_admin"]}},
            projection={"_id": 0},
        )
        async for u in staff_cursor:
            self.counts["staff_scanned"] += 1
            existing = await self._existing_person_for_user(u["id"])
            if existing:
                continue
            pid = await self._create_person(u, default_type=u["role"])
            await self._upsert_map(u["id"], pid)
            self.counts["staff_persons_created"] += 1
            if u.get("email"):
                await self._ensure_email_credential(pid, u["email"], status="active")
            if (u.get("mobile") or "").strip():
                await self._ensure_mobile_credential(
                    pid, u["mobile"].strip(),
                    status="active",
                    verified_at=u.get("mobile_verified_at"),
                )

    async def _link_user_to_new_person(self, u: dict, *, make_mobile_active: bool,
                                       mobile_value: str | None = None) -> str:
        existing = await self._existing_person_for_user(u["id"])
        if existing:
            # idempotent: same Person already minted
            pid = existing
        else:
            pid = await self._create_person(u)
            await self._upsert_map(u["id"], pid)

        mob = mobile_value or (u.get("mobile") or "").strip()
        if mob:
            await self._ensure_mobile_credential(
                pid, mob,
                status="active" if make_mobile_active else "revoked",
                verified_at=u.get("mobile_verified_at"),
            )
        if u.get("email"):
            await self._ensure_email_credential(pid, u["email"], status="active")
        return pid

    async def _create_person(self, u: dict, *, default_type: str = "citizen") -> str:
        pid = new_id("p_")
        # Map V1 role → V2 person type
        type_map = {
            "citizen": "citizen", "worker": "worker", "pa": "staff",
            "politician": "politician", "admin": "staff", "super_admin": "staff",
        }
        t = type_map.get(default_type, default_type)
        person = {
            "id": pid,
            "name": u.get("name") or "Unknown",
            "dob": u.get("dob"),
            "gender": u.get("gender"),
            "email": u.get("email"),
            "photo_path": u.get("photo_path"),
            "types": [t],
            "status": "active",
            "merged_into_person_id": None,
            "created_at": u.get("created_at") or now_iso(),
            "updated_at": now_iso(),
        }
        await self._insert("persons", person)
        self.counts["persons_created"] += 1
        await self._audit(pid, "migrated_from_v1",
                          {"v1_user_id": u["id"], "v1_role": u.get("role"),
                           "v1_tenant_id": u.get("tenant_id")})
        return pid

    async def _ensure_mobile_credential(self, person_id: str, mobile: str,
                                        *, status: str, verified_at: str | None) -> None:
        # If a credential with this person+mobile already exists from a prior run,
        # skip (idempotent). Active-uniqueness is enforced by index, so we never
        # need to "upgrade" a revoked credential to active in the same run.
        existing = None
        if not self.dry_run:
            existing = await self.db.credentials.find_one(
                {"person_id": person_id, "type": "mobile", "value": mobile}
            )
        if existing:
            return
        cred = {
            "id": new_id("c_"),
            "person_id": person_id,
            "type": "mobile",
            "value": mobile,
            "verified_at": verified_at,
            "last_used_at": None,
            "status": status,
            "created_at": now_iso(),
        }
        try:
            await self._insert("credentials", cred)
            self.counts["credentials_created"] += 1
            if status == "revoked":
                self.counts["credentials_revoked"] += 1
        except Exception as e:
            # The partial-unique index on (type,value) WHERE status="active" will
            # reject a duplicate active mobile. Surface as an error rather than
            # silently dropping.
            self.errors.append(f"credential insert failed person={person_id} mobile={mobile}: {e}")

    async def _ensure_email_credential(self, person_id: str, email: str, *, status: str) -> None:
        email = email.strip().lower()
        if not email:
            return
        if not self.dry_run:
            existing = await self.db.credentials.find_one(
                {"person_id": person_id, "type": "email", "value": email}
            )
            if existing:
                return
        cred = {
            "id": new_id("c_"),
            "person_id": person_id,
            "type": "email",
            "value": email,
            "verified_at": None,
            "last_used_at": None,
            "status": status,
            "created_at": now_iso(),
        }
        try:
            await self._insert("credentials", cred)
            self.counts["credentials_created"] += 1
        except Exception as e:
            self.errors.append(f"email credential insert failed person={person_id}: {e}")

    async def _audit(self, person_id: str, event: str, payload: dict) -> None:
        rec = {
            "id": new_id("a_"),
            "person_id": person_id,
            "event": event,
            "at": now_iso(),
            "by_user_id": None,
            "by_tenant_id": payload.get("v1_tenant_id"),
            "payload": payload,
        }
        await self._insert("person_audit", rec)
        self.counts["audit_entries"] += 1

    async def _timeline_event(self, *, person_id: str, organisation_id: str | None,
                              membership_id: str | None, event_type: str,
                              at: str, ref_collection: str | None, ref_id: str | None,
                              label: str, summary: str | None = None,
                              tier: str = "operational") -> None:
        """Amendment 1.1 — emit one denormalised timeline event."""
        rec = {
            "id": new_id("t_"),
            "person_id": person_id,
            "organisation_id": organisation_id,
            "membership_id": membership_id,
            "event_type": event_type,
            "at": at,
            "ref_collection": ref_collection,
            "ref_id": ref_id,
            "label": label,
            "summary": summary,
            "tier": tier,
        }
        await self._insert("person_timeline_events", rec)
        self.counts["timeline_events_created"] += 1

    # ----------------------------------------------------------------
    #                         PHASE B — Memberships
    # ----------------------------------------------------------------
    async def phase_memberships(self) -> None:
        """One membership per V1 citizen user. When multiple users were merged
        into one Person, the MOST RECENT keeps status='active'; older ones
        become status='archived' with end_date set and transfer_reason='migration'.
        """
        # Build per-person map: person_id → list of (user, sorted_by_created_at)
        cursor = self.db.users.find({"role": "citizen"}, projection={"_id": 0})
        users_by_person: dict[str, list[dict]] = defaultdict(list)
        async for u in cursor:
            pid = await self._existing_person_for_user(u["id"])
            if not pid:
                continue  # phase A didn't link this user (dry-run skipping, or error)
            users_by_person[pid].append(u)

        for pid, users in users_by_person.items():
            users_sorted = sorted(users, key=lambda x: x.get("created_at") or "")
            newest = users_sorted[-1]

            for i, u in enumerate(users_sorted):
                if await self._membership_exists(pid, u["id"]):
                    continue
                is_active = (i == len(users_sorted) - 1)
                next_user = users_sorted[i + 1] if not is_active else None
                m = {
                    "id": new_id("m_"),
                    "person_id": pid,
                    "organisation_id": u.get("tenant_id"),
                    "scope_type": "constituency",
                    "household_id": u.get("household_id"),
                    "ward_id": u.get("ward_id"),
                    "village_id": u.get("village_id"),
                    "state": u.get("state"),
                    "district": u.get("district"),
                    "taluka": u.get("taluka"),
                    "address": u.get("address"),
                    "start_date": u.get("created_at") or now_iso(),
                    "end_date": (next_user.get("created_at") if next_user else None),
                    "status": "active" if is_active else "archived",
                    "transfer_reason": ("migration" if not is_active else None),
                    "transferred_from_membership_id": None,
                    "transferred_to_membership_id": None,         # Amendment 1.1
                    "transferred_to_organisation_id": None,       # Amendment 1.1
                    "archive_reason": (None if is_active else "transferred"),  # Amendment 1.1
                    "is_primary": True,
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                    "_origin_user_id": u["id"],   # idempotency anchor
                }
                await self._insert("memberships", m)
                self.counts["memberships_created"] += 1
                if not is_active:
                    self.counts["memberships_archived"] += 1
                # Seed a "registered" timeline event for the citizen's first join.
                await self._timeline_event(
                    person_id=pid,
                    organisation_id=u.get("tenant_id"),
                    membership_id=m["id"],
                    event_type="registered",
                    at=u.get("created_at") or now_iso(),
                    ref_collection="memberships", ref_id=m["id"],
                    label=("Joined constituency"
                           if is_active else "Joined (later transferred)"),
                    tier="public",
                )

            # Cache active membership pointers on Person.
            if not self.dry_run:
                active_mem = await self.db.memberships.find_one(
                    {"person_id": pid, "status": "active"},
                    projection={"id": 1, "organisation_id": 1, "_id": 0},
                )
                if active_mem:
                    await self.db.persons.update_one(
                        {"id": pid},
                        {"$set": {
                            "current_organisation_id": active_mem.get("organisation_id"),
                            "current_membership_id": active_mem.get("id"),
                            "updated_at": now_iso(),
                        }},
                    )

            # Auto-grant tier1+tier2 consent for the active org
            if newest.get("tenant_id"):
                for tier in ("tier1", "tier2"):
                    await self._ensure_consent(pid, newest["tenant_id"], tier,
                                               source="auto_on_registration")

    async def _membership_exists(self, person_id: str, user_id: str) -> bool:
        if self.dry_run:
            return False
        return await self.db.memberships.find_one(
            {"person_id": person_id, "_origin_user_id": user_id}
        ) is not None

    async def _ensure_consent(self, person_id: str, org_id: str, scope: str,
                              *, source: str) -> None:
        if self.dry_run:
            return
        existing = await self.db.person_consents.find_one(
            {"person_id": person_id, "organisation_id": org_id, "scope": scope}
        )
        if existing:
            return
        rec = {
            "id": new_id("k_"),
            "person_id": person_id,
            "organisation_id": org_id,
            "scope": scope,
            "granted_at": now_iso(),
            "revoked_at": None,
            "source": source,
        }
        await self._insert("person_consents", rec)
        self.counts["consents_created"] += 1

    # ----------------------------------------------------------------
    #                  PHASE C — Stamp person_id on operational rows
    # ----------------------------------------------------------------
    async def phase_stamp_operational(self) -> None:
        """Issues carry citizen_id (a V1 user_id). Stamp person_id by joining
        through the user→person map."""
        map_cursor = self.db["_v2_user_to_person"].find({})
        u2p: dict[str, str] = {}
        async for m in map_cursor:
            u2p[m["_id"]] = m["person_id"]

        # In dry-run mode the map is empty (Phase A didn't write). Use an
        # in-memory projection so we can still report what WOULD happen.
        if self.dry_run and not u2p:
            async for u in self.db.users.find({}, projection={"id": 1, "_id": 0}):
                u2p[u["id"]] = "dry_run_pid_for_" + u["id"]

        # ISSUES (citizen_id → person_id + origin_membership_id)
        # Build a (person_id, tenant_id) → membership_id lookup so we can pin
        # each issue to the membership active at its creation. In dry-run we
        # fall through to None.
        pmem_lookup: dict[tuple[str, str], str] = {}
        if not self.dry_run:
            async for m in self.db.memberships.find(
                {}, projection={"_id": 0, "id": 1, "person_id": 1, "organisation_id": 1}
            ):
                pmem_lookup[(m["person_id"], m["organisation_id"])] = m["id"]

        async for issue in self.db.issues.find(
            {}, projection={"_id": 0, "id": 1, "citizen_id": 1, "person_id": 1,
                            "tenant_id": 1, "title": 1, "issue_code": 1, "created_at": 1}
        ):
            self.counts["issues_scanned"] += 1
            if issue.get("person_id"):
                self.counts["issues_already_stamped"] += 1
                continue
            pid = u2p.get(issue.get("citizen_id"))
            if not pid:
                self.errors.append(f"issue {issue['id']} has citizen_id={issue.get('citizen_id')} not in user→person map")
                continue
            mem_id = pmem_lookup.get((pid, issue.get("tenant_id")))
            if not self.dry_run:
                await self.db.issues.update_one(
                    {"id": issue["id"]},
                    {"$set": {"person_id": pid,
                              "origin_membership_id": mem_id,
                              "_migration_run_id": self.run_id}},
                )
                # Emit timeline event for the complaint
                await self._timeline_event(
                    person_id=pid,
                    organisation_id=issue.get("tenant_id"),
                    membership_id=mem_id,
                    event_type="complaint_raised",
                    at=issue.get("created_at") or now_iso(),
                    ref_collection="issues", ref_id=issue["id"],
                    label=f"Complaint {issue.get('issue_code') or issue['id'][:8]}",
                    summary=issue.get("title"),
                    tier="operational",
                )
            self.counts["issues_stamped"] += 1

        # INTERACTIONS (V1 stored citizen user_id in field oddly named "person_id"
        # — we have to rewrite, since V2 person_id has a different value space).
        async for it in self.db.interactions.find({}, projection={"_id": 0, "id": 1, "person_id": 1}):
            self.counts["interactions_scanned"] += 1
            v1_user_id = it.get("person_id")
            pid = u2p.get(v1_user_id)
            if not pid:
                self.errors.append(f"interaction {it['id']} has legacy person_id={v1_user_id} not in map")
                continue
            if pid == v1_user_id:
                # already rewritten in a previous run
                self.counts["interactions_already_stamped"] += 1
                continue
            if not self.dry_run:
                await self.db.interactions.update_one(
                    {"id": it["id"]},
                    {"$set": {"person_id": pid, "_v1_legacy_person_id": v1_user_id,
                              "_migration_run_id": self.run_id}},
                )
            self.counts["interactions_stamped"] += 1

        # Visits / DevWorks / Notifications: these are broadcasts and have no
        # individual person reference in V1. The person_id field exists in the
        # V2 schema for future person-specific records but stays NULL here.
        # We report what is intentionally NOT stamped.
        for coll in ("visits", "devworks", "notifications"):
            self.counts[f"{coll}_skipped_no_person_ref"] = await self.db[coll].count_documents({})

    # ----------------------------------------------------------------
    #                       PHASE D — Relationships
    # ----------------------------------------------------------------
    async def phase_relationships(self) -> None:
        """Migrate V1 `relationships` → `relationships_v2` rewriting user_ids
        as person_ids and dropping tenant_id. Idempotent — keyed on V1 id."""
        map_cursor = self.db["_v2_user_to_person"].find({})
        u2p: dict[str, str] = {}
        async for m in map_cursor:
            u2p[m["_id"]] = m["person_id"]
        if self.dry_run and not u2p:
            async for u in self.db.users.find({}, projection={"id": 1, "_id": 0}):
                u2p[u["id"]] = "dry_run_pid_for_" + u["id"]

        async for r in self.db.relationships.find({}, projection={"_id": 0}):
            self.counts["relationships_scanned"] += 1
            if not self.dry_run:
                existing = await self.db.relationships_v2.find_one(
                    {"_v1_relationship_id": r["id"]}
                )
                if existing:
                    self.counts["relationships_already_migrated"] += 1
                    continue
            from_pid = u2p.get(r.get("person_a"))
            to_pid = u2p.get(r.get("person_b"))
            if not (from_pid and to_pid):
                self.errors.append(
                    f"relationship {r['id']} has unmapped endpoint "
                    f"person_a={r.get('person_a')} person_b={r.get('person_b')}")
                continue
            new_rel = {
                "id": new_id("r_"),
                "from_person_id": from_pid,
                "to_person_id": to_pid,
                "type": r.get("type"),
                "since_date": r.get("since"),
                "until_date": None,
                "status": "active",
                "notes": r.get("notes"),
                "created_at": r.get("created_at") or now_iso(),
                "created_by_person_id": None,
                "_v1_relationship_id": r["id"],
            }
            await self._insert("relationships_v2", new_rel)
            self.counts["relationships_migrated"] += 1

    # ----------------------------------------------------------------
    #                       PHASE E — Validation
    # ----------------------------------------------------------------
    async def phase_validate(self) -> dict:
        """Hard validation gates. Failures abort and (when --commit) trigger
        rollback of this run."""
        report: dict = {"checks": {}, "ok": True}

        # 1) every citizen user must map to a person
        citizens = await self.db.users.count_documents({"role": "citizen"})
        if self.dry_run:
            # dry-run doesn't actually write to _v2_user_to_person, so derive
            # the expected mapped count from the in-memory phase A.
            mapped_citizens = self.counts.get("citizens_scanned", 0) - len(self.conflict_mobiles) * 2
        else:
            # Count only mapping rows whose user is a citizen.
            citizen_ids = [u["id"] async for u in self.db.users.find({"role": "citizen"}, projection={"id": 1, "_id": 0})]
            mapped_citizens = await self.db["_v2_user_to_person"].count_documents({"_id": {"$in": citizen_ids}})
        report["checks"]["every_citizen_mapped"] = {
            "expected": citizens, "actual": mapped_citizens,
            "ok": (mapped_citizens + len(self.conflict_mobiles) * 2 >= citizens),
        }

        # 2) every Person has exactly one active membership (v1 rule)
        if not self.dry_run:
            pipeline = [
                {"$match": {"status": "active"}},
                {"$group": {"_id": "$person_id", "n": {"$sum": 1}}},
                {"$match": {"n": {"$gt": 1}}},
            ]
            multi_active = await self.db.memberships.aggregate(pipeline).to_list(100)
            report["checks"]["one_active_membership_per_person"] = {
                "violations": len(multi_active), "ok": (len(multi_active) == 0),
                "examples": multi_active[:5],
            }

        # 3) every active mobile credential is unique (enforced by index, but we still check)
        if not self.dry_run:
            pipeline = [
                {"$match": {"type": "mobile", "status": "active"}},
                {"$group": {"_id": "$value", "n": {"$sum": 1}}},
                {"$match": {"n": {"$gt": 1}}},
            ]
            dup_mobiles = await self.db.credentials.aggregate(pipeline).to_list(100)
            report["checks"]["active_mobile_unique"] = {
                "violations": len(dup_mobiles), "ok": (len(dup_mobiles) == 0),
                "examples": dup_mobiles[:5],
            }

        # 4) every Issue with citizen_id has a person_id (after stamping)
        if not self.dry_run:
            unstamped = await self.db.issues.count_documents(
                {"citizen_id": {"$exists": True, "$ne": None},
                 "$or": [{"person_id": None}, {"person_id": {"$exists": False}}]}
            )
            report["checks"]["issues_stamped"] = {
                "violations": unstamped, "ok": (unstamped == 0),
            }

        # 5) every relationship_v2 endpoint exists in persons
        if not self.dry_run:
            bad = 0
            async for r in self.db.relationships_v2.find({}, projection={"_id": 0, "from_person_id": 1, "to_person_id": 1}):
                for fld in ("from_person_id", "to_person_id"):
                    if not await self.db.persons.find_one({"id": r[fld]}):
                        bad += 1
            report["checks"]["relationships_v2_endpoints_valid"] = {
                "violations": bad, "ok": (bad == 0),
            }

        # 6) duplicate-mobile conflicts that were not resolved
        report["checks"]["unresolved_conflicts"] = {
            "violations": len(self.conflict_mobiles), "ok": (not self.conflict_mobiles),
            "mobiles": self.conflict_mobiles,
        }

        report["ok"] = all(c.get("ok", True) for c in report["checks"].values())
        return report

    # ----------------------------------------------------------------
    #                       PHASE F — Run record
    # ----------------------------------------------------------------
    async def write_run_record(self, validation: dict, elapsed_s: float) -> None:
        rec = {
            "_id": self.run_id,
            "started_at": self.started_at,
            "finished_at": now_iso(),
            "elapsed_s": elapsed_s,
            "dry_run": self.dry_run,
            "counts": dict(self.counts),
            "errors": self.errors,
            "validation": validation,
        }
        if not self.dry_run:
            await self.db["_v2_migration_runs"].insert_one(rec)
        # Always write to disk for human review
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        path = REPORT_DIR / f"m2_{self.run_id}.json"
        path.write_text(json.dumps(rec, indent=2, default=str))

    # ----------------------------------------------------------------
    #                            ORCHESTRATION
    # ----------------------------------------------------------------
    async def run(self) -> dict:
        t0 = time.time()
        await self.phase_persons()
        # If unresolved conflicts in commit mode, abort BEFORE further phases.
        if self.conflict_mobiles and not self.dry_run:
            elapsed = time.time() - t0
            validation = await self.phase_validate()
            await self.write_run_record(validation, elapsed)
            await Rollback(self.db, self.run_id).execute()
            return {"ok": False, "rolled_back": True, "validation": validation, "counts": dict(self.counts)}
        await self.phase_memberships()
        await self.phase_stamp_operational()
        await self.phase_relationships()
        validation = await self.phase_validate()
        elapsed = time.time() - t0
        await self.write_run_record(validation, elapsed)

        if not self.dry_run and not validation["ok"]:
            # Hard fail → rollback
            await Rollback(self.db, self.run_id).execute()
            return {"ok": False, "rolled_back": True, "validation": validation, "counts": dict(self.counts),
                    "errors": self.errors,
                    "run_id": self.run_id, "elapsed_s": elapsed}

        return {"ok": True, "validation": validation, "counts": dict(self.counts),
                "errors": self.errors, "run_id": self.run_id, "elapsed_s": elapsed,
                "conflict_mobiles": self.conflict_mobiles}


# ============================================================================
#                                ROLLBACK
# ============================================================================

class Rollback:
    """Delete every row created during a specific run, by `_migration_run_id`."""

    V2_COLLECTIONS = [
        "persons", "credentials", "memberships", "person_audit",
        "person_consents", "relationships_v2", "_v2_user_to_person",
        "person_timeline_events",   # Amendment 1.1
    ]

    def __init__(self, db: AsyncIOMotorDatabase, run_id: str):
        self.db = db
        self.run_id = run_id

    async def execute(self) -> dict:
        report: dict = {"deleted": {}, "unstamped": {}}
        # Delete tagged V2 rows.
        for coll in self.V2_COLLECTIONS:
            res = await self.db[coll].delete_many({"_migration_run_id": self.run_id})
            report["deleted"][coll] = res.deleted_count
        # Un-stamp person_id on operational rows for this run.
        for coll in ("issues", "interactions"):
            res = await self.db[coll].update_many(
                {"_migration_run_id": self.run_id},
                {"$set": {"person_id": None},
                 "$unset": {"_migration_run_id": "", "_v1_legacy_person_id": "",
                            "origin_membership_id": ""}},
            )
            report["unstamped"][coll] = res.modified_count
        # Clear cached current_* pointers on Persons we created (handled by
        # the persons delete above, but also clear on any survivors)
        await self.db.persons.update_many(
            {"_migration_run_id": {"$ne": self.run_id}},
            {"$set": {"current_organisation_id": None, "current_membership_id": None}},
        )
        # Mark the run record as rolled back (don't delete — keep for audit)
        await self.db["_v2_migration_runs"].update_one(
            {"_id": self.run_id}, {"$set": {"rolled_back_at": now_iso()}}, upsert=False
        )
        return report


# ============================================================================
#                               REPORTING
# ============================================================================

def print_report(result: dict) -> None:
    print("=" * 72)
    print(f"M2 BACKFILL RESULT  run_id={result.get('run_id', '<dry-run>')}")
    print("=" * 72)
    print(f"  ok            : {result.get('ok')}")
    print(f"  rolled_back   : {result.get('rolled_back', False)}")
    print(f"  elapsed (s)   : {result.get('elapsed_s', 0):.3f}")
    print()
    print("Counts:")
    for k, v in sorted(result.get("counts", {}).items()):
        print(f"  {k:35s}: {v}")
    if result.get("conflict_mobiles"):
        print()
        print("Unresolved duplicate-mobile conflicts:")
        for m in result["conflict_mobiles"]:
            print(f"  - {m}  (provide --dedupe-csv with a decision row)")
    if result.get("errors"):
        print()
        print("Errors:")
        for e in result["errors"][:50]:
            print(f"  ! {e}")
    print()
    print("Validation:")
    for name, chk in result.get("validation", {}).get("checks", {}).items():
        flag = "OK" if chk.get("ok") else "FAIL"
        v = chk.get("violations", chk.get("actual"))
        print(f"  [{flag:4s}] {name:38s} : {v}")
    print("=" * 72)


# ============================================================================
#                                  CLI
# ============================================================================

async def amain(args: argparse.Namespace) -> int:
    load_dotenv("/app/backend/.env")
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    if args.rollback:
        report = await Rollback(db, args.rollback).execute()
        print("Rollback report:")
        print(json.dumps(report, indent=2))
        return 0

    if args.report_only:
        rec = await db["_v2_migration_runs"].find_one({"_id": args.report_only})
        if not rec:
            print(f"No run found with id {args.report_only}", file=sys.stderr)
            return 1
        print(json.dumps(rec, indent=2, default=str))
        return 0

    if not (args.dry_run or args.commit):
        print("Specify --dry-run or --commit (or --rollback <id>)", file=sys.stderr)
        return 2

    dedupe = load_dedupe_decisions(Path(args.dedupe_csv) if args.dedupe_csv else None)
    bf = Backfill(db, dry_run=args.dry_run, dedupe=dedupe)
    result = await bf.run()
    print_report(result)
    return 0 if result.get("ok") else 3


def main() -> int:
    p = argparse.ArgumentParser(description="M2 — V1→V2 backfill engine")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", help="report what would happen, write nothing")
    g.add_argument("--commit", action="store_true", help="write V2 rows; validate; rollback on failure")
    g.add_argument("--rollback", metavar="RUN_ID", help="undo a previous --commit run by its run_id")
    g.add_argument("--report-only", metavar="RUN_ID", help="print stored report for a previous run")
    p.add_argument("--dedupe-csv", metavar="PATH",
                   help="CSV produced by `migrations.dedupe_report` with `decision` column filled")
    args = p.parse_args()
    return asyncio.run(amain(args))


if __name__ == "__main__":
    sys.exit(main())
