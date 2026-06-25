"""M0 — Pre-flight Dedupe Report (read-only).

Surfaces every mobile number that currently exists in TWO OR MORE tenants in
V1's `users.citizen` collection.  This is the human-review gate before the M2
backfill creates Person rows.  Without resolving these conflicts up-front,
M2 cannot decide whether two citizen records belong to the same human.

Outputs
-------
1. CSV   /app/migrations/dedupe_<YYYYMMDD>.csv
2. JSON  /app/migrations/dedupe_<YYYYMMDD>.json     (machine-readable map)
3. stdout summary

For each duplicate mobile the report classifies the conflict:

  • AUTO_MERGE     — names match (Levenshtein >= 0.9) AND dobs agree (or any side blank)
  • REVIEW_NAME    — names differ; manual decision required
  • REVIEW_DOB     — names match but DOBs disagree
  • REVIEW_OTHER   — any other ambiguity

The decisions you record (by editing the CSV's `decision` column and re-
running with --apply) become the input to M2.  Until then this script does
NOT write to the database.

Usage
-----
    cd /app/backend && python -m migrations.dedupe_report           # report
    cd /app/backend && python -m migrations.dedupe_report --json    # also JSON
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


REPORT_DIR = Path("/app/migrations")


def _similarity(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.strip().lower(), b.strip().lower()).ratio()


def _classify(rows: list[dict]) -> str:
    """rows = all V1 citizen records that share one mobile."""
    names = [(r.get("name") or "").strip() for r in rows]
    dobs = [(r.get("dob") or "").strip() for r in rows]
    # AUTO_MERGE only when every pairwise name similarity >= 0.9 AND DOBs agree
    # (or any DOB is blank — blank means "unknown", not "different").
    pairs = [
        _similarity(names[i], names[j])
        for i in range(len(names))
        for j in range(i + 1, len(names))
    ]
    name_match = all(p >= 0.9 for p in pairs) if pairs else True
    distinct_dobs = {d for d in dobs if d}
    dob_match = len(distinct_dobs) <= 1

    if name_match and dob_match:
        return "AUTO_MERGE"
    if not name_match:
        return "REVIEW_NAME"
    if not dob_match:
        return "REVIEW_DOB"
    return "REVIEW_OTHER"


async def main(write_json: bool) -> int:
    load_dotenv("/app/backend/.env")
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # All citizen users across all tenants. We INCLUDE soft-disabled tenants
    # because their citizens still need to be represented in V2.
    cursor = db.users.find({"role": "citizen"}, projection={
        "_id": 0,
        "id": 1, "mobile": 1, "name": 1, "dob": 1, "email": 1,
        "tenant_id": 1, "household_id": 1, "created_at": 1, "gender": 1,
    })
    by_mobile: dict[str, list[dict]] = defaultdict(list)
    total_citizens = 0
    no_mobile = 0
    async for u in cursor:
        total_citizens += 1
        m = (u.get("mobile") or "").strip()
        if not m:
            no_mobile += 1
            continue
        by_mobile[m].append(u)

    duplicates = {m: rows for m, rows in by_mobile.items() if len(rows) > 1}

    # Resolve tenant slugs for human readability.
    org_ids = {r["tenant_id"] for rows in duplicates.values() for r in rows if r.get("tenant_id")}
    slug_map: dict[str, str] = {}
    if org_ids:
        async for p in db.portal_configs.find(
            {"id": {"$in": list(org_ids)}},
            projection={"_id": 0, "id": 1, "slug": 1, "constituency_name": 1},
        ):
            slug_map[p["id"]] = p.get("slug") or p.get("constituency_name") or p["id"]

    # ---------- Write CSV ----------
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    csv_path = REPORT_DIR / f"dedupe_{stamp}.csv"
    json_path = REPORT_DIR / f"dedupe_{stamp}.json"

    counts: dict[str, int] = defaultdict(int)
    json_payload: dict[str, dict] = {}

    with csv_path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "mobile", "row_index", "classification",
            "user_id", "tenant_slug", "name", "dob", "email",
            "gender", "household_id", "created_at",
            "decision (MERGE | KEEP_SEPARATE | leave blank)",
        ])
        for mobile, rows in sorted(duplicates.items()):
            cls = _classify(rows)
            counts[cls] += 1
            json_payload[mobile] = {
                "classification": cls,
                "rows": [
                    {
                        "user_id": r["id"],
                        "tenant_id": r.get("tenant_id"),
                        "tenant_slug": slug_map.get(r.get("tenant_id") or ""),
                        "name": r.get("name"),
                        "dob": r.get("dob"),
                        "email": r.get("email"),
                        "household_id": r.get("household_id"),
                        "created_at": r.get("created_at"),
                    }
                    for r in rows
                ],
            }
            for i, r in enumerate(rows):
                w.writerow([
                    mobile, i, cls,
                    r["id"],
                    slug_map.get(r.get("tenant_id") or "", r.get("tenant_id") or ""),
                    r.get("name") or "",
                    r.get("dob") or "",
                    r.get("email") or "",
                    r.get("gender") or "",
                    r.get("household_id") or "",
                    r.get("created_at") or "",
                    "MERGE" if cls == "AUTO_MERGE" else "",
                ])

    if write_json:
        json_path.write_text(json.dumps(json_payload, indent=2))

    # ---------- Summary ----------
    print("=" * 70)
    print("M0 DEDUPE PRE-FLIGHT REPORT")
    print("=" * 70)
    print(f"Total V1 citizen rows scanned   : {total_citizens}")
    print(f"  (skipped, no mobile recorded) : {no_mobile}")
    print(f"Unique mobiles                  : {len(by_mobile)}")
    print(f"Mobiles with duplicates         : {len(duplicates)}")
    print()
    print("Conflict classification:")
    for k in ("AUTO_MERGE", "REVIEW_NAME", "REVIEW_DOB", "REVIEW_OTHER"):
        print(f"  {k:14s} : {counts.get(k, 0)}")
    print()
    print(f"CSV  written to : {csv_path}")
    if write_json:
        print(f"JSON written to : {json_path}")
    print()
    if counts.get("REVIEW_NAME") or counts.get("REVIEW_DOB") or counts.get("REVIEW_OTHER"):
        print("Action required: open the CSV, set a `decision` for every REVIEW_* row,")
        print("save, and re-run M2 with --dedupe-csv pointing to the reviewed file.")
        return 2
    if duplicates:
        print("All duplicates auto-classified for merge. Safe to proceed to M2.")
    else:
        print("No cross-tenant duplicate mobiles. Safe to proceed to M2.")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="store_true", help="also emit the machine-readable JSON")
    args = p.parse_args()
    sys.exit(asyncio.run(main(write_json=args.json)))
