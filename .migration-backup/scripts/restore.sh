#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# JANSETU — Restore Script
#
# Restores MongoDB + uploaded files from a backup created by backup.sh.
#
# Usage:
#   ./scripts/restore.sh /var/backups/jansetu/20250716_020000
#
# WARNING: This REPLACES the live database and uploads. Stop user traffic first.
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="${1:-}"

if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
    echo "Usage: $0 <backup-directory>"
    echo "Example: $0 /var/backups/jansetu/20250716_020000"
    exit 1
fi

# Load .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

MONGO_ROOT_USER="${MONGO_ROOT_USER:-admin}"
MONGO_ROOT_PASSWORD="${MONGO_ROOT_PASSWORD:-}"
DB_NAME="${DB_NAME:-jansetu}"
UPLOADS_VOLUME="jansetu_uploads_data"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "⚠  Restoring from: ${BACKUP_DIR}"
log "   Database : ${DB_NAME}"
log "   This will OVERWRITE the live database and uploads."
read -rp "   Type 'yes' to continue: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { log "Aborted."; exit 0; }

# ── 1. Restore MongoDB ────────────────────────────────────────────────────────
MONGO_BACKUP="${BACKUP_DIR}/mongodb.tar.gz"
if [[ ! -f "$MONGO_BACKUP" ]]; then
    echo "ERROR: ${MONGO_BACKUP} not found"; exit 1
fi

log "Extracting MongoDB dump …"
TMP_DIR=$(mktemp -d)
tar -xzf "${MONGO_BACKUP}" -C "${TMP_DIR}"

log "Copying dump into MongoDB container …"
docker compose cp "${TMP_DIR}/mongodb" mongodb:/tmp/restore_dump

log "Running mongorestore (drop existing collections first) …"
docker compose exec -T mongodb mongorestore \
    --username  "${MONGO_ROOT_USER}" \
    --password  "${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase admin \
    --db        "${DB_NAME}" \
    --drop \
    /tmp/restore_dump/${DB_NAME}

docker compose exec -T mongodb rm -rf /tmp/restore_dump
rm -rf "${TMP_DIR}"
log "MongoDB restore complete."

# ── 2. Restore uploaded files ─────────────────────────────────────────────────
UPLOADS_BACKUP="${BACKUP_DIR}/uploads.tar.gz"
if [[ -f "$UPLOADS_BACKUP" ]]; then
    log "Restoring uploaded files to volume ${UPLOADS_VOLUME} …"
    docker run --rm \
        -v "${UPLOADS_VOLUME}:/data" \
        -v "${BACKUP_DIR}:/backup:ro" \
        busybox sh -c "rm -rf /data/* && tar xzf /backup/uploads.tar.gz -C /data"
    log "Uploads restored."
else
    log "No uploads backup found — skipping."
fi

# ── 3. Restart services ───────────────────────────────────────────────────────
log "Restarting backend …"
docker compose restart backend

log "✅ Restore complete. Verify the application at your domain."
