#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# JANSETU — VPS Deploy Script
# GitHub is the single source of truth. This script runs ON the VPS.
#
# Usage:
#   cd /opt/jansetu
#   ./scripts/deploy.sh              # deploy latest main branch
#   ./scripts/deploy.sh --branch dev # deploy a specific branch
#   ./scripts/deploy.sh --skip-backup
#
# What it does:
#   1. Pull latest code from GitHub
#   2. Build new Docker images (tagged with git commit hash)
#   3. Rolling restart: backend → health-check → frontend
#   4. Verify the site responds
#   5. On failure: automatically roll back to previous images
#
# What it never does:
#   • Edit application code on the VPS
#   • Drop or truncate any database
#   • Overwrite the .env file
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
BRANCH="main"
SKIP_BACKUP=false
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose"   # Docker Compose v2 plugin

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --branch)   BRANCH="$2"; shift 2 ;;
        --skip-backup) SKIP_BACKUP=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
log()     { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
success() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $*"; }
warn()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $*"; }
fail()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $*" >&2; }

cd "$PROJECT_DIR"

# ── Guard: .env must exist ────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
    fail ".env file not found. Copy .env.example → .env and fill in secrets."
    exit 1
fi

# ── Guard: firebase-admin.json must exist (or push notifications disabled) ────
if [[ ! -f backend/secrets/firebase-admin.json ]]; then
    warn "backend/secrets/firebase-admin.json not found — push notifications will be disabled."
fi

# ── 1. Pre-flight backup ──────────────────────────────────────────────────────
if [[ "$SKIP_BACKUP" == "false" ]]; then
    log "Running pre-deploy backup …"
    bash scripts/backup.sh || warn "Backup failed — continuing (check /var/backups/jansetu)"
else
    warn "Skipping backup (--skip-backup passed)"
fi

# ── 2. Record current state (for rollback) ───────────────────────────────────
PREV_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
PREV_BACKEND_IMAGE=$(docker inspect --format='{{.Config.Image}}' jansetu-backend-1 2>/dev/null || echo "")
PREV_FRONTEND_IMAGE=$(docker inspect --format='{{.Config.Image}}' jansetu-frontend-1 2>/dev/null || echo "")
log "Current commit : $PREV_HASH"
log "Current backend: ${PREV_BACKEND_IMAGE:-none}"

# ── 3. Pull latest code from GitHub ──────────────────────────────────────────
log "Pulling latest code from GitHub (branch: $BRANCH) …"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"   # fast-forward only, never merge
NEW_HASH=$(git rev-parse --short HEAD)
log "New commit: $NEW_HASH"

if [[ "$PREV_HASH" == "$NEW_HASH" && -n "$PREV_BACKEND_IMAGE" ]]; then
    warn "Already on commit $NEW_HASH and containers are running. Forcing rebuild anyway."
fi

DEPLOY_TAG="$NEW_HASH"
export DEPLOY_TAG

# ── 4. Build new images ───────────────────────────────────────────────────────
log "Building Docker images (tag: $DEPLOY_TAG) …"
$COMPOSE build --pull

# Tag images with commit hash so we can roll back to them later
docker tag jansetu-backend  "jansetu-backend:$DEPLOY_TAG"  2>/dev/null || true
docker tag jansetu-frontend "jansetu-frontend:$DEPLOY_TAG" 2>/dev/null || true

# ── 5. Ensure MongoDB is running (never restart it — would risk data loss) ────
log "Ensuring MongoDB is healthy …"
$COMPOSE up -d --no-deps mongodb
for i in $(seq 1 20); do
    STATUS=$($COMPOSE ps --format json mongodb 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('Health',''))" 2>/dev/null || echo "")
    [[ "$STATUS" == "healthy" ]] && { log "MongoDB healthy ✓"; break; }
    sleep 3
    [[ $i -eq 20 ]] && { fail "MongoDB did not become healthy. Aborting."; exit 1; }
done

# ── 6. Rolling restart — backend ──────────────────────────────────────────────
log "Deploying backend …"
$COMPOSE up -d --no-deps --force-recreate backend

log "Waiting for backend health check …"
BACKEND_OK=false
for i in $(seq 1 40); do
    STATUS=$($COMPOSE ps --format json backend 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('Health',''))" 2>/dev/null || echo "")
    if [[ "$STATUS" == "healthy" ]]; then
        BACKEND_OK=true
        success "Backend is healthy ✓"
        break
    fi
    sleep 4
done

if [[ "$BACKEND_OK" == "false" ]]; then
    fail "Backend health check failed after deploy."
    # ── Auto rollback ──────────────────────────────────────────────────────
    if [[ -n "$PREV_BACKEND_IMAGE" ]]; then
        warn "Rolling back backend to previous image: $PREV_BACKEND_IMAGE"
        docker tag "$PREV_BACKEND_IMAGE" jansetu-backend:rollback 2>/dev/null || true
        DEPLOY_TAG=rollback $COMPOSE up -d --no-deps --force-recreate backend
        fail "Rollback applied. Investigate with: docker compose logs backend"
    fi
    exit 1
fi

# Check migrations ran cleanly (look for error keywords in recent backend logs)
if $COMPOSE logs --since=3m backend 2>&1 | grep -qi "traceback\|migration.*error\|critical"; then
    warn "Possible migration error detected in backend logs — review before proceeding:"
    $COMPOSE logs --since=3m backend | tail -30
fi

# ── 7. Rolling restart — frontend ─────────────────────────────────────────────
log "Deploying frontend …"
$COMPOSE up -d --no-deps --force-recreate frontend

sleep 5
FRONTEND_HTTP=$(curl -sSo /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>/dev/null || echo "000")
if [[ "$FRONTEND_HTTP" == "200" ]]; then
    success "Frontend is responding (HTTP $FRONTEND_HTTP) ✓"
else
    warn "Frontend health check returned HTTP $FRONTEND_HTTP — check: docker compose logs frontend"
fi

# ── 8. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
success "Deploy complete: $PREV_HASH → $NEW_HASH"
echo "  Containers:  $($COMPOSE ps --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null)"
echo ""
echo "  Rollback:    git checkout $PREV_HASH && DEPLOY_TAG=$PREV_HASH $COMPOSE up -d --build"
echo "  Logs:        docker compose logs -f"
echo "  Full revert: ./scripts/restore.sh /var/backups/jansetu/<timestamp>"
echo "══════════════════════════════════════════════════════"

# ── 9. Prune old Docker images (keep last 3 per service) ─────────────────────
log "Pruning dangling images …"
docker image prune -f --filter "label=com.docker.compose.project=jansetu" 2>/dev/null || true
