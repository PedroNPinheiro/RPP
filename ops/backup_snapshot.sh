#!/usr/bin/env bash
#
# Nightly backup of status_snapshot — the RPP analytics history table.
#
# This table is the ONLY data in the system that can't be re-derived: parts and
# Sage columns re-sync from Sage, but the daily analytics history exists only
# once it has been recorded. So we keep dated dumps of just this one table.
#
# Restore a backup with:
#   gunzip -c /var/lib/rpp/backups/status_snapshot-YYYY-MM-DD.sql.gz \
#     | sudo -u postgres psql rpp
# (the dump is --clean, so it drops and recreates the table from the backup.)
#
set -euo pipefail

DB="rpp"
BACKUP_DIR="/var/lib/rpp/backups"
KEEP_DAYS=60

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/status_snapshot-$(date +%F).sql.gz"
TMP="$OUT.partial"
trap 'rm -f "$TMP"' EXIT

# dump schema + data for the single table; write to a temp file first so a
# failed dump never leaves a corrupt dated backup behind
sudo -u postgres pg_dump --no-owner --clean --if-exists \
  --table=status_snapshot "$DB" | gzip > "$TMP"
mv "$TMP" "$OUT"

# prune backups older than KEEP_DAYS
find "$BACKUP_DIR" -name 'status_snapshot-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "backed up status_snapshot -> $OUT ($(du -h "$OUT" | cut -f1))"
