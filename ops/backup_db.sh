#!/usr/bin/env bash
#
# Nightly full backup of the RPP database + uploaded attachment files.
#
# What's irreplaceable (this is why the backup matters): the team-filled
# columns in `parts` (status, priority, category, area, OF/PC, dates, notes,
# drawings…), the `part_audit` trail, and `status_snapshot` do NOT come from
# Sage — only the Sage columns re-sync. Attachment FILES live on disk under
# uploads/, referenced by the part_attachments table, so we back those up too.
#
# Restore the DB into a throwaway copy to inspect it:
#   sudo -u postgres createdb rpp_restore
#   sudo -u postgres pg_restore --no-owner -d rpp_restore \
#     /var/lib/rpp/backups/rpp-db-YYYY-MM-DD.dump
#
# Restore OVER production (careful — drops/recreates objects):
#   sudo -u postgres pg_restore --no-owner --clean --if-exists -d rpp \
#     /var/lib/rpp/backups/rpp-db-YYYY-MM-DD.dump
#
# Restore attachment files:
#   sudo tar -xzf /var/lib/rpp/backups/rpp-uploads-YYYY-MM-DD.tar.gz -C /var/lib/rpp
#
set -euo pipefail

DB="rpp"
BACKUP_DIR="/var/lib/rpp/backups"
UPLOAD_DIR="/var/lib/rpp/uploads"
KEEP_DAYS=30
STAMP="$(date +%F)"

mkdir -p "$BACKUP_DIR"

# 1) whole database — custom format (compressed, restorable with pg_restore).
#    Write to a temp file first so a failed dump never leaves a corrupt backup.
DB_OUT="$BACKUP_DIR/rpp-db-$STAMP.dump"
TMP="$DB_OUT.partial"
trap 'rm -f "$TMP"' EXIT
sudo -u postgres pg_dump --no-owner --format=custom "$DB" > "$TMP"
mv "$TMP" "$DB_OUT"

# 2) attachment files (not stored in the DB)
if [ -d "$UPLOAD_DIR" ] && [ -n "$(ls -A "$UPLOAD_DIR" 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/rpp-uploads-$STAMP.tar.gz" \
    -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
fi

# 3) prune old backups
find "$BACKUP_DIR" -name 'rpp-db-*.dump'        -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'rpp-uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "backed up db -> $DB_OUT ($(du -h "$DB_OUT" | cut -f1))"
