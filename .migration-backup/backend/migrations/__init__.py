"""JanSetu V2 migration utilities.

Phases (per Master Architecture v1.0 §11):
  M0  dedupe_report   — read-only pre-flight; surfaces mobiles existing in
                        multiple V1 tenants and flags name/DOB conflicts for
                        human review.
  M1  indexes         — create V2 collection indexes on backend startup
                        (additive, idempotent).
  M2  backfill        — populate Person + Credential + Membership rows from
                        V1 users.citizen rows; stamp person_id on operational
                        records.  (delivered in next session)
  M3  dual_write      — write paths emit V1 + V2 simultaneously; reads still
                        come from V1.
  M4  cutover         — reads switch to V2; frontend uses person_id.
  M5  decommission    — V1 citizen rows dropped after 30-day stability.

Every script is idempotent and read-only-by-default. Mutations require an
explicit --commit flag (M2 onward).
"""
