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
1. MLA Approval Inbox widget (next session)
2. PDF + Excel report exports
3. Twilio SMS OTP integration
4. Firebase Cloud Messaging
5. Phase-2 UI: Person profile + Family graph editor
