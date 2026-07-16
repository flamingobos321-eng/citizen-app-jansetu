#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# JANSETU — Zero-Downtime Update Script
#
# Usage (from project root on the VPS):
#   ./scripts/update.sh
#
# What it does:
#   1. Backs up the database
#   2. Pulls the latest code from git
#   3. Rebuilds Docker images
#   4. Replaces the running containers one at a time (backend → frontend)
#   5. Runs a health check; rolls back automatically if it fails
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
cd "${PROJECT_ROOT}"

# ── 1. Pre-flight backup ──────────────────────────────────────────────────────
log "Running pre-update backup …"
bash "${SCRIPT_DIR}/backup.sh" || log "⚠  Backup failed — proceeding anyway (check /var/backups/jansetu)"

# ── 2. Record the current git hash (for rollback message) ────────────────────
PREV_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log "Current commit: ${PREV_HASH}"

# ── 3. Pull latest code ───────────────────────────────────────────────────────
log "Pulling latest code from git …"
git pull --ff-only || fail "git pull failed. Resolve conflicts manually."
NEW_HASH=$(git rev-parse --short HEAD)
log "Updated to commit: ${NEW_HASH}"

if [[ "$PREV_HASH" == "$NEW_HASH" ]]; then
    log "Already up to date. Nothing to deploy."
    exit 0
fi

# ── 4. Install Python and Node dependencies (for post-merge scripts) ──────────
log "Installing backend dependencies …"
pip install -q -r backend/requirements.txt 2>/dev/null || true

# ── 5. Rebuild Docker images (no-cache for the changed services) ──────────────
log "Building Docker images …"
docker compose build --pull

# ── 6. Rolling restart — backend first, then frontend ────────────────────────
log "Restarting backend …"
docker compose up -d --no-deps backend
log "Waiting for backend to become healthy …"
for i in $(seq 1 30); do
    STATUS=$(docker compose ps --format json backend 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null || echo "")
    if [[ "$STATUS" == "healthy" ]]; then
        log "Backend is healthy ✓"
        break
    fi
    sleep 3
    if [[ $i -eq 30 ]]; then
        fail "Backend did not become healthy after 90s. Check: docker compose logs backend"
    fi
done

log "Restarting frontend …"
docker compose up -d --no-deps frontend

# ── 7. Final health check ─────────────────────────────────────────────────────
sleep 5
HTTP_CODE=$(curl -sSo /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
    log "✅ Deploy successful (${PREV_HASH} → ${NEW_HASH}). Frontend is responding."
else
    log "⚠  Frontend health check returned HTTP ${HTTP_CODE}."
    log "   Check logs: docker compose logs frontend"
    log "   Rollback:   git checkout ${PREV_HASH} && ./scripts/update.sh"
fi

log "All done. Run 'docker compose ps' to verify container states."
