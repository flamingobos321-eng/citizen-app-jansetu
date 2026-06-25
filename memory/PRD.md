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
1. **(Open) M3** — Server-side guards for issue assignment & status workflow (P1)
2. **(Open) M2** — Notification composer ward/village targeting in UI (P1)
3. **(Open) M4** — Citizen feedback state guard (P2)
4. **(Open) M6** — Celebrations endpoint projection optimization (P2)
5. **(Backlog) C2** — Real Twilio OTP (currently mocked, accepts any 6 digits) (P1, deferred)
6. **(Backlog) Setup Wizard UI** — Tenant Admin first-login wizard (backend endpoints `/tenant/setup` already live; user opted to skip for now and access from dashboard)
7. **(Tech debt) Super admin DELETE portal** — returns 403; require_roles("admin") should also accept super_admin for portal CRUD

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

