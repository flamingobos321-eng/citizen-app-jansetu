#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# JANSETU — Automated Backup Script
# Backs up MongoDB + uploaded files to /var/backups/jansetu
#
# Usage (run from project root):
#   ./scripts/backup.sh
#
# Add to cron for daily 2 AM backups:
#   0 2 * * * /path/to/jansetu/scripts/backup.sh >> /var/log/jansetu-backup.log 2>&1
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_ROOT="/var/backups/jansetu"
RETAIN_DAYS=30          # keep backups this many days
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

# Load variables from .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

MONGO_ROOT_USER="${MONGO_ROOT_USER:-admin}"
MONGO_ROOT_PASSWORD="${MONGO_ROOT_PASSWORD:-}"
DB_NAME="${DB_NAME:-jansetu}"
UPLOADS_VOLUME="jansetu_uploads_data"   # docker volume name

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Prepare directories ───────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"
log "Backup started → ${BACKUP_DIR}"

# ── 1. MongoDB dump ───────────────────────────────────────────────────────────
log "Dumping MongoDB (database: ${DB_NAME}) …"
docker compose exec -T mongodb mongodump \
    --username  "${MONGO_ROOT_USER}" \
    --password  "${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase admin \
    --db        "${DB_NAME}" \
    --out       /tmp/mongodump_${TIMESTAMP}

# Copy the dump out of the container
docker compose cp mongodb:/tmp/mongodump_${TIMESTAMP} "${BACKUP_DIR}/mongodb"

# Clean up inside container
docker compose exec -T mongodb rm -rf /tmp/mongodump_${TIMESTAMP}

# Compress
tar -czf "${BACKUP_DIR}/mongodb.tar.gz" -C "${BACKUP_DIR}" mongodb
rm -rf "${BACKUP_DIR}/mongodb"
log "MongoDB dump compressed → ${BACKUP_DIR}/mongodb.tar.gz"

# ── 2. Uploaded files ─────────────────────────────────────────────────────────
log "Backing up uploaded files from Docker volume (${UPLOADS_VOLUME}) …"
docker run --rm \
    -v "${UPLOADS_VOLUME}:/data:ro" \
    -v "${BACKUP_DIR}:/backup" \
    busybox tar czf /backup/uploads.tar.gz -C /data .
log "Uploads backed up → ${BACKUP_DIR}/uploads.tar.gz"

# ── 3. Environment file ───────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "${BACKUP_DIR}/.env.bak"
    chmod 600 "${BACKUP_DIR}/.env.bak"
    log "Environment file copied"
fi

# ── 4. Finalise and write manifest ───────────────────────────────────────────
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
cat > "${BACKUP_DIR}/MANIFEST.txt" <<EOF
JANSETU Backup — ${TIMESTAMP}
DB: ${DB_NAME}
Hostname: $(hostname)
Size: ${TOTAL_SIZE}
Files:
$(ls -lh "${BACKUP_DIR}")
EOF

log "Backup complete. Total size: ${TOTAL_SIZE}"

# ── 5. Rotate old backups ─────────────────────────────────────────────────────
log "Removing backups older than ${RETAIN_DAYS} days …"
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +${RETAIN_DAYS} -exec rm -rf {} + 2>/dev/null || true
REMAINING=$(ls "${BACKUP_ROOT}" | wc -l)
log "Rotation done. ${REMAINING} backup(s) kept in ${BACKUP_ROOT}"
