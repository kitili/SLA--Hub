#!/bin/bash
# ============================================================
# Silverleaf Academy — Database Backup Script
# Run via cron: 0 2 * * * /opt/silverleaf/backup.sh
# ============================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────
BACKUP_DIR="/opt/silverleaf/backups"
DB_CONTAINER="silverleaf_db"
DB_NAME="silverleaf_v3"
DB_USER="silverleaf"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/silverleaf_${TIMESTAMP}.sql.gz"

# ── Create backup directory ────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "🗄️  Starting database backup: ${TIMESTAMP}"

# ── Dump database ─────────────────────────────────────────────
docker exec "${DB_CONTAINER}" \
  pg_dump -U "${DB_USER}" "${DB_NAME}" \
  | gzip > "${BACKUP_FILE}"

# Verify backup was created and is non-empty
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "❌ Backup failed — file is empty"
  exit 1
fi

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Remove old backups ─────────────────────────────────────────
find "${BACKUP_DIR}" -name "silverleaf_*.sql.gz" \
  -mtime "+${RETENTION_DAYS}" -delete

REMAINING=$(ls "${BACKUP_DIR}" | wc -l)
echo "📁 Backups retained: ${REMAINING} files (${RETENTION_DAYS}-day window)"

# ── Optional: upload to S3 / Backblaze B2 ─────────────────────
# Uncomment and configure if you use remote backup storage:
#
# AWS_BUCKET="s3://your-bucket/silverleaf-backups/"
# aws s3 cp "${BACKUP_FILE}" "${AWS_BUCKET}" --storage-class STANDARD_IA
# echo "☁️  Uploaded to S3"

# ── Log completion ─────────────────────────────────────────────
echo "🎉 Backup complete: $(date)"
