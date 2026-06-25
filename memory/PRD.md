# JANSETU – CONSTITUENCY OPERATING SYSTEM — PRD

## Vision
Become the **digital memory of an entire constituency** — preserving citizen, family, and political-relationship history across generations and leadership changes.

## Current Priority (delivered MVP)
- Citizen Registration (Mobile OTP, household linking + auto member count)
- Citizen Profile page
- Complaint / Issue Management (12 categories, 8-stage workflow with reassignment)
- Households (with auto stats)
- Visits with MLA approval workflow
- Targeted Notifications (ward/village/all + recipients count + sender)
- Development Works with approval & citizen-visible projects
- Role-based access (Citizen / Worker / PA / MLA / Admin)
- Search by household code, name, mobile, address, house#
- Photos (before/after) + GPS location + OSM map preview
- Dashboards with auto-refresh polling
- Admin reset endpoint for real-data onboarding

## Long-Term Vision — Schema Foundations LAID (no UI yet)
To avoid future database redesign, the following are now in place:

### 1. Person Master (extends existing `users` collection)
Fields added: `anniversary`, `occupation`, `profile_photo`, `notes`, `status` (alive/deceased), `date_of_death`, `supporter_since`, `political_role`, `influence_level`, `political_notes`, `family_lineage` (list of `{leader_name, era, since_year, notes}`).

### 2. Family Relationship System (`relationships` collection)
- 16 relation types (Father, Mother, Son, Daughter, Brother, Sister, Husband, Wife, Grandfather, Grandmother, Uncle, Aunt, Nephew, Niece, Cousin, Other)
- Edge-based graph: `{person_a, person_b, type, since, notes}` — enables future family-tree generation.

### 3. Multi-Generation Political History
- Stored on each person via `family_lineage` array — supports records like:
  - Ganesh Shinde → connected with Shankarrao Kolhe since 1990
  - Ramesh Shinde → Snehalata Kolhe since 2005
  - Rahul Shinde → Vivek Kolhe since 2024
- Records persist regardless of `status=deceased`.

### 4. Service Interactions (`interactions` collection)
Beyond issues — captures meetings, scholarship help, medical assistance, financial help, etc., with worker, status, remarks, photos, and `occurred_at`. Permanent history per person.

### 5. Deceased Records
Never deleted. `status="deceased"` + `date_of_death` preserves all relationships and history.

### 6. Birthdays & Anniversaries Widget
Endpoint `GET /api/dashboard/celebrations?days=7` returns today's + upcoming birthdays and anniversaries (excludes deceased).

## New Backend Endpoints (foundational)
- `GET /api/meta/relation-types`
- `GET /api/persons/{id}` — 360° (person + relationships + interactions + issues)
- `PUT /api/persons/{id}` — update person/political-CRM fields
- `POST /api/relationships` / `DELETE /api/relationships/{id}`
- `POST /api/interactions`
- `GET /api/dashboard/celebrations`

## Deferred Roadmap (UI to be built in future iterations)
- **Phase 2**: Person 360° profile UI; Family Graph editor; Celebration widgets on dashboard
- **Phase 3**: Auto family-tree visualizer; Multi-generation lineage timeline
- **Phase 4**: Political CRM (influence scoring, campaign history, election participation)
- **Phase 5**: MLA Approval Inbox; PDF/Excel exports; Real SMS OTP (Twilio); Firebase Push

## Next Action Items
1. **(NEXT) Sprint A — M2** Backfill script: create Person + Credential + Membership rows from V1 `users.citizen`; stamp `person_id` on `issues`. Idempotent. Dry-run first.
2. **(NEXT) Sprint A — M3** Dual-read / dual-write window. Backend writes both V1 + V2 paths; parity asserter daily.
3. **(NEXT) Sprint A — M4** Frontend cutover: auth returns `person_id`; relationships, Person 360 read V2.
4. **(NEXT) Sprint A — M5** Decommission V1 citizen rows after 30-day stability.
5. **(Open) M3** — Server-side guards for issue assignment & status workflow (P1)
6. **(Open) M2-original** — Notification composer ward/village targeting in UI (P1)
7. **(Open) M4-original** — Citizen feedback state guard (P2)
8. **(Open) M6-original** — Celebrations endpoint projection optimization (P2)
9. **(Backlog) C2** — Real Twilio OTP (currently mocked, accepts any 6 digits) (P1, deferred)
10. **(Backlog) Setup Wizard UI** — Tenant Admin first-login wizard (backend endpoints `/tenant/setup` already live; user opted to skip for now and access from dashboard)
11. **(Tech debt) Super admin DELETE portal** — returns 403; require_roles("admin") should also accept super_admin for portal CRUD

## V2 Architecture (Master Spec v1.0 — SIGNED OFF Feb 2026)

Identity / Membership / Privacy redesign. Person = permanent identity, Mobile = credential, Membership = polymorphic person ↔ organisation link with history. Three-tier privacy (Public / Operational / Intelligence). Migration phased M0 → M5.

### Sprint A — Identity & Migration (in progress)
- **M0 — Pre-flight dedupe report (DONE Feb 2026)**
  - `/app/backend/migrations/dedupe_report.py` scans V1 `users.citizen`, groups by mobile, auto-classifies as `AUTO_MERGE | REVIEW_NAME | REVIEW_DOB | REVIEW_OTHER` using SequenceMatcher (>= 0.9) for names and exact-match for DOBs.
  - Output: `/app/migrations/dedupe_YYYYMMDD.csv` (human-editable) + optional JSON.
  - Tested on current dev data: 5 citizens, 1 cross-tenant mobile flagged `REVIEW_NAME` (Ramesh Sharma vs Manish Jha share `9999900001`).
- **M1 — Additive V2 schema (DONE Feb 2026)**
  - Pydantic models appended to `/app/backend/models.py`: `Person`, `Credential`, `Membership`, `RelationshipV2`, `PersonAudit`, `PersonConsent`, `AccessAudit`, plus Sprint-B schemas (`Party`, `PositionDefinition`, `PartyMembership`, `Election`, `ElectionEvent`, `InfluenceSignal`).
  - `Issue.person_id` (nullable) added — fills during M2/M3.
  - Startup hook `_ensure_v2_indexes()` in `server.py` — idempotent, additive; creates 13 V2 collections + indexes. Marks `system_meta.v2_schema.version=1`.
  - Unique partial index on `credentials(type, value)` where `status="active"` — enforces credential uniqueness only among active rows.
  - **Regression: V1 untouched.** Super admin / tenant admin / worker / citizen logins all 200; V2 collections empty.

### Sprint A — remaining (next sessions)
- M3 dual-write window (1 week parity). Backend writes both V1 + V2 paths simultaneously.
- M4 frontend cutover (auth `pid`, Person 360 reads V2).
- M5 decommission V1 citizen rows.

### M2 — Backfill Engine (DONE Feb 2026)
- `/app/backend/migrations/m2_backfill.py` — `--dry-run | --commit | --rollback <run_id> | --report-only <run_id>`.
- Idempotent via `_v2_user_to_person` anchor map; run-tagged via `_migration_run_id` on every row.
- Dedupe CSV-driven (`--dedupe-csv`); `MERGE` collapses many users → one Person with archived memberships, `KEEP_SEPARATE` keeps separate Persons with older mobile credentials → `revoked`.
- Staff also become Persons (`types=["worker"|"staff"|"politician"]`) to satisfy V2 spec D2 (Person = universal entity).
- Hard validation gates: every-citizen-mapped, ≤1 active membership per person, active mobile uniqueness, every-issue-stamped, relationships_v2 endpoints valid, no unresolved conflicts. Fail = auto-rollback.
- Audit/report written to `/app/migrations/m2_<run_id>.json` + `_v2_migration_runs` collection.
- 15-case test suite at `/app/backend/tests/test_m2_backfill.py` (all pass): clean migration / dry-run write-nothing / idempotent re-run / duplicate mobile abort / MERGE / KEEP_SEPARATE / cross-tenant / Issue.person_id stamped / Interaction legacy person_id rewritten / Relationship → relationships_v2 / household preservation / rollback round-trip / orphan-issue validation / dedupe CSV blank-decision aborts / dedupe CSV parsing.
- Verified on dev data: 21 persons (5 citizens + 16 staff), 23 credentials, 5 active memberships, 14/14 issues stamped, all 6 validations green, 57 ms full run.
- Rollback round-trip verified: deleted 21 persons/23 creds/5 memberships/21 audits/10 consents/21 mappings, un-stamped 14 issues. Subsequent re-commit restored V2 state cleanly.

### Sprint B — Political CRM & Influence (after Sprint A stable for 30 days)
- Party / position / party_memberships UIs.
- Elections + election_events import.
- Influence signals rule engine + politician dashboards.
- Household intelligence (T3) with audit ledger.
- Three-tier privacy decorator (`@scope_check`).


## Multi-Tenant Phase 3 — COMPLETED (Feb 2026)
### Backend (previously delivered)
- `POST /admin/portals` auto-provisions tenant admin with temp password, returns credentials once
- `POST /admin/portals/{id}/reset-admin-password` regenerates temp password
- `/auth/staff/login`, `/auth/citizen/request-otp`, `/auth/citizen/verify-otp`, `/auth/citizen/register` accept optional `tenant_slug`
- `POST /auth/change-password` for forced first-login password change
- Per-tenant counters with idempotent startup sync
- `must_change_password` flag on User model

### Frontend (delivered this session)
- **AdminPortals.jsx**: `ProvisionedDialog` shows tenant admin email, temp password, staff login URL, citizen portal URL after portal creation. Each row has a "Reset Admin" button that opens the same dialog. Optional `primary_admin_email` / `primary_admin_name` inputs in the create form.
- **StaffLogin.jsx**: Auto-detects `?portal=<slug>`, fetches `/api/portals/{slug}` for branding, applies logo/theme color/politician name. Sends `tenant_slug` in login payload. Hides demo accounts under portal context. Redirects to `/app/change-password` when `must_change_password=true`.
- **CitizenLogin.jsx**: Same branding logic; passes `tenant_slug` in OTP request/verify; carries `tenant_slug` + portal context into CitizenRegister via location state.
- **CitizenRegister.jsx**: Renders portal context banner; sends `tenant_slug` in registration payload.
- **ChangePassword.jsx** (new): Forced password-change page wired into `Guard` / `TenantGuard` redirect when `must_change_password=true`. Calls `POST /auth/change-password`, refreshes `/auth/me`, navigates back to `/app`.
- **App.js**: New `/app/change-password` route, `ChangePasswordGuard`, redirect logic in both Guard and TenantGuard.

### Setup Wizard
Per user direction (Feb 2026), the multi-step setup wizard was descoped. Only the **forced password change** on first login is enforced. Branding / wards / staff are configured from the standard dashboard after login.



## V2 Phase M3 — Dual-Write Backend COMPLETED (Feb 2026)
**Goal:** Every V1 mutation also writes V2 (persons/credentials/memberships/timeline) so the two stay perfectly in sync during shadow mode. V1 contracts unchanged; V1 remains authoritative.

### Schema additions
- `Membership.scope_type` now includes `"staff"` (so staff Persons can be ORG-bound for `origin_membership_id` stamping while keeping `Person.current_organisation_id` NULL per spec).
- `Visit` / `Notification` / `DevWork` / `ServiceInteraction` / `Relationship` all gained `origin_membership_id: Optional[str]`.
- `PersonTimelineEvent.event_type` expanded to include: `complaint_assigned`, `complaint_in_progress`, `complaint_reassigned`, `complaint_feedback`, `visit_announced`, `visit_approved`, `devwork_announced`, `devwork_completed`, `notification_published`, `profile_updated`, `membership_created`, `relationship_added`, `relationship_removed`.

### Endpoints wired to dual-write
`citizen_register`, `create_staff`, `update_person`, `create_issue`, `assign_issue`, `update_status`, `feedback`, `approve_reassign`, `create_visit`, `approve_visit`, `create_notif`, `create_dev`, `update_dev` (status), `create_interaction`, `create_relationship`, `delete_relationship`.

### Helpers (`backend/v2_dualwrite.py`)
`ensure_person_for_user` (citizen/staff branching), `resolve_active_membership`, `resolve_person_and_membership`, `sync_issue_to_v2`, `sync_issue_event`, `sync_visit_to_v2`, `sync_visit_approved`, `sync_notification_to_v2`, `sync_devwork_to_v2`, `sync_devwork_status`, `sync_interaction_to_v2`, `sync_relationship_to_v2`, `revoke_relationship_v2`, `sync_person_profile_update`, `sync_household_update`, `parity_report`.

### New endpoints (super-admin only)
- `GET /api/admin/v2/parity` — comprehensive report covering 17 invariants (I1 citizens mapped, I2 mobile uniqueness, I3 one active membership per citizen, I4 no orphan memberships, I5 no orphan timeline events, I6 no orphan citizen persons, I7 all operational rows have `person_id`, I8 all operational rows have `origin_membership_id`).
- `POST /api/admin/v2/parity/backfill-missing` — idempotent: lazy-mints any missing Persons + re-stamps any unstamped operational rows.

### Test coverage
- `tests/test_m3_dualwrite.py` — 14 unit tests (helpers, idempotency, parity assertions, staff-scope memberships, etc.)
- `tests/test_m3_e2e_dualwrite.py` — 13 HTTP-layer end-to-end tests (created by backend testing agent)
- `tests/test_m2_backfill.py` — 15 baseline tests still green
- **Total: 42/42 passing.**

### Live preview DB
Parity endpoint returns `ok=True` across all 17 invariants on the running DB after running `POST /api/admin/v2/parity/backfill-missing` once.

### Status: SHADOW MODE
V1 still authoritative. Frontend untouched (no cutover yet). M4 frontend cutover comes AFTER the Constituency Transfer Workflow.

## Next Priorities (post-M3)
1. **Citizen Constituency Transfer Workflow (P0)** — lookup dialog, OTP transfer step, confirmation, membership archival API. Will leverage `sync_membership_archived` (to be added in next phase).
2. **V2 Phase M4 — Frontend Cutover (P0)** — swap auth payloads to include `person_id`; update relationship/timeline components to use V2 endpoints.
3. **Political CRM Module (P1)** — `parties`, `position_definitions`, `election_events`.
4. **Three-Tier Privacy Gating & Consent Ledger (P1)**.
5. **Access Audit Log + Politician Self-Service Report (P2)**.
6. **Real OTP / Fast2SMS Integration (P1)** — keep provider-agnostic; plug-in pattern.
7. **V2 Phase M5 — Decommission V1 schemas (P2)**.

### Known minor backlog items (non-blocking)
- Notifications composer: ward/village targeting in UI (P1)
- Citizen feedback: missing state guard (P2)
- Celebrations endpoint: 5000 full user docs without projection (P2)
- Add a parity invariant for "every staff Person has staff-scope membership AND current_organisation_id is NULL" (currently only implicitly covered).
- Strip `_dualwrite_marker` from V2 read API responses (cosmetic; harmless for shadow mode).


## Citizen Constituency Transfer Workflow — COMPLETED (Feb 2026)
**Goal:** Allow a citizen registered in Constituency A who visits Constituency B's portal to transfer their Person (and their entire lifetime history) without ever creating a duplicate Person record.

### Backend
- New models: `TransferRequest`, `MembershipAudit`, `TransferInitiate`, `TransferVerify`, `TransferAddress`, `CitizenMobileCheck`.
- New module `backend/v2_transfer.py`: `detect_transfer_need`, `initiate_transfer`, `verify_and_execute_transfer`, `get_person_membership_history`.
- New endpoints:
  - `POST /api/auth/citizen/check-mobile` — detection (returns transfer payload).
  - `POST /api/auth/citizen/transfer/initiate` — creates TransferRequest, mocks OTP.
  - `POST /api/auth/citizen/transfer/verify` — atomic execution (archive old, create new, cross-link, audit, timeline, consents, fresh JWT).
  - `GET /api/me/transfer-info` — citizen's transferred-from banner data + membership history.
- Modified endpoints:
  - `POST /api/auth/citizen/register` — returns HTTP 409 with `detail.code='TRANSFER_REQUIRED'` when mobile exists at a different tenant.
  - `POST /api/auth/citizen/verify-otp` — returns `{transferred_out:true, current_portal}` when a citizen tries to log into a constituency they've been transferred away from (blocks token issuance).
  - `GET /api/persons/{id}` — includes `transfer_banner` for transferred-out citizens so old-constituency staff get a read-only banner.

### Frontend
- `CitizenRegister.jsx` — TransferConfirmDialog (`transfer-confirm-dialog`) + TransferOtpDialog (`transfer-otp-dialog`). Reads `tenant_slug` from React Router state OR `?portal=` query string. `/areas` 401 swallowed gracefully.
- `CitizenLogin.jsx` — redirects transferred-out citizens to their new portal with a toast.
- `CitizenHome.jsx` — TransferredFromBanner (`transferred-from-banner`) showing previous org + transfer reason.
- `PersonProfile.jsx` (staff view) — TransferredOutBanner (`transferred-out-banner`) for archived citizens.

### Invariants verified
- No duplicate Persons (the existing Person is reused).
- No duplicate active Memberships (old becomes `archived`, new becomes `active`).
- Mobile credential remains active and tied to the same Person.
- Family relationships (`relationships_v2`) untouched — they are person-id linked, not user-id linked.
- All operational records (issues / visits / devworks / interactions / notifications) keep their original `tenant_id` and `origin_membership_id` → old tenant retains read access; new tenant cannot see them.
- Parity report still returns `ok=true` across all 17 invariants after transfer.

### Test coverage
- `tests/test_m3_transfer.py` — 14 unit tests (detect / initiate / verify happy + edge cases / family / idempotency / OTP / expiry / history).
- `tests/test_m3_transfer_e2e.py` — 12 HTTP-layer E2E tests against the live preview (1 skipped harness-limit, not a backend bug).
- Cumulative regression: **55 passed, 1 skipped** (transfer + dual-write + M2 backfill).

### Status
- Backend: production-ready (within shadow mode constraints).
- Frontend: minimum surface for THIS feature. M4 frontend cutover NOT started per user direction.
- Real OTP / Fast2SMS still MOCKED (any 6-digit OTP accepted) — provider-agnostic so a `Fast2SmsProvider` can swap in at the end.

## Next Priorities
1. **V2 Phase M4 — Frontend Cutover (P0)** — swap auth payloads to use `person_id`; introduce Person 360 view consuming `/me/transfer-info` + `person_timeline_events`.
2. **Political CRM Module (P1)** — `parties`, `position_definitions`, `election_events`.
3. **Three-Tier Privacy Gating & Consent Ledger (P1)**.
4. **Access Audit Log + Politician Self-Service Report (P2)**.
5. **Real Fast2SMS OTP integration (P1)**.
6. **V2 Phase M5 — Decommission V1 schemas (P2)**.

## V2 Phase M4 — Frontend Cutover (minimum) COMPLETED (Feb 2026)
- New backend endpoints: `GET /api/me/timeline` (citizen cross-tenant self-view) + `GET /api/persons/{id}/timeline` (staff tenant-scoped).
- New component `frontend/src/components/PersonTimeline.jsx` (V2 `person_timeline_events` renderer).
- Wired into `CitizenHome.jsx` (Person 360 timeline) and `PersonProfile.jsx` (staff view).
- `useAuth()` already exposes `user.person_id`; no auth-context change required.

## Next Priorities
1. Political CRM Module (P1) — parties, positions, elections.
2. Three-Tier Privacy Gating + Consent Ledger (P1).
3. Access Audit Log + Politician Self-Service Report (P2).
4. Real Fast2SMS OTP integration (P1, end of project).
5. V2 Phase M5 — Decommission V1 schemas (P2).



## Core CRM Polish — COMPLETED (Feb 2026)
**Backend:**
- Feedback state guard added: `POST /api/issues/{id}/feedback` now rejects with HTTP 400 unless `status="Resolved"`.
- `/api/dashboard/celebrations` switched to a slim projection (no longer pulls 5000 full user docs).
- New CSV report endpoints (PA/Politician/Admin): `/api/reports/households.csv`, `/api/reports/citizens.csv`, `/api/reports/devworks.csv`, `/api/reports/visits.csv`, plus `/api/reports/summary` (JSON counts).
- DRY refactor: single `_csv_response()` helper now powers all `/reports/*.csv` endpoints.

**Frontend:**
- `Notifications.jsx` composer now supports ward / village targeting (multi-select chips, scope=all/ward/village). Validates non-empty selections.
- `CitizensList.jsx` member rows are now `<Link>` to `PersonProfile` (`member-link-<id>`).
- `Visits.jsx` adds status + type filters (`visits-filter-status`, `visits-filter-type`).
- New page `Reports.jsx` (`/app/reports`) — staff-only — summary tiles + CSV download cards for citizens / households / issues / devworks / visits.
- Sidebar (`Layout.jsx`) gains a "Reports" nav entry for staff roles.

**Tests:** 43/43 backend pytest pass.
