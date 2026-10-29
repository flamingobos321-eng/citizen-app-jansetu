# JanSetu

JanSetu is a constituency management platform for citizens, elected representatives,
and their staff. This workspace is being prepared for separate web and native apps.

## Required stack and scope

- Preserve the original Python FastAPI service and MongoDB data model.
- Do not replace them with the scaffold's Express, PostgreSQL, or Drizzle examples.
- Do not run database migrations, seeds, backfills, or resets as part of this port.
- Keep the GitHub/VPS deployment, existing variable names, and private configuration.
- The native Expo app is separate follow-up work, not part of the web port.

## Run

- Web preview: managed workflow `artifacts/jansetu-web: web`.
- API preview: managed workflow `artifacts/api-server: API Server`.
- Both use artifact-assigned `PORT`; the shared proxy sends `/api` to FastAPI
  without rewriting the path, and `/` to the existing React/CRACO application.
- The web app keeps `REACT_APP_BACKEND_URL=""` for same-origin `/api` requests.
- Backend variables remain `MONGO_URL`, `DB_NAME`, `JWT_SECRET`,
  `LOCAL_STORAGE_PATH`, and the existing optional SMS/storage/Firebase settings.
- Install Node dependencies with `pnpm install --frozen-lockfile`.
- Install the workspace Python runtime with `bash scripts/install-python.sh`.
- Run isolated authentication tests with:
  `env -u MONGO_URL -u DB_NAME -u JWT_SECRET python -m pytest tests/test_auth_flow.py -q`.
  These tests stub MongoDB and do not connect to live data.

## Source and deployment

- `artifacts/jansetu-web/`: original React routes, styles, public assets, CRACO,
  Tailwind 3 configuration, and Capacitor configuration. It is not a UI redesign.
- `backend/`: original FastAPI application, models, and dependency snapshots.
  Docker installs the hash-pinned `requirements-runtime.txt` export of `uv.lock`.
  Regenerate this export whenever workspace Python dependencies change; see
  `DEPLOY.md`. The broad legacy snapshots are retained for reference.
- `artifacts/api-server/`: service registration and launcher for that Python app.
  The unused TypeScript scaffold is not the JanSetu backend.
- `lib/*`: unused workspace scaffolds; they are not the application's data model.
- `.migration-backup/`: original recoverable source retained by the migration
  scaffold. Existing tracked files remain recoverable in Git; new backup files
  are ignored and the directory is excluded from deployment. Do not remove it
  before the web port is accepted.
- `docker-compose.yml`, `scripts/deploy.sh`, `DEPLOY.md`: existing GitHub/VPS
  deployment. Only the frontend build context moved to `artifacts/jansetu-web`.
  Backend source path, database volumes, environment file, and service names remain.
- Future Expo work should create its own artifact and use the same `/api` contract;
  do not move or rewrite the web app again.

## Preview data safety

The original backend's startup lifecycle seeds demo data, performs tenant
backfills, synchronizes counters, and creates indexes. The API preview launcher
uses `--lifespan off` to avoid those writes and scheduled escalations when opening
the preview against an existing database. User-requested API mutations still work.
Production startup (the existing Dockerfile or `pnpm --filter @workspace/api-server
run start`) retains the original lifecycle; do not run it as a migration check.

If MongoDB DNS or connectivity fails, surface the configuration problem. Do not
switch databases, create demo data, or silently substitute mock responses.
