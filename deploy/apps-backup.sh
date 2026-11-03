#!/usr/bin/env bash
# Nightly backup of SCGSS on the apps VM (SCGSS Backend Setup Guide, step 13): a pg_dump of the app_scgss database, plus the uploaded
# files kept on this VM's disk. Run from a systemd timer or cron as a user that can read /srv/apps/scgss/data and connect to the database.
# Needs: postgresql-client, age, rclone (configured for the Shared Drive). AGE_PUBLIC_KEY is the PUBLIC key; keep the private key elsewhere.
# DATABASE_URL is read from /etc/apps/scgss.env when not already set.
set -euo pipefail
: "${AGE_PUBLIC_KEY:?set AGE_PUBLIC_KEY}"; : "${RCLONE_DEST:=gdrive-shared:Backups/}"
if [ -z "${DATABASE_URL:-}" ]; then set -a; . /etc/apps/scgss.env; set +a; fi
D=/srv/apps/scgss/data; OUT=/var/backups/apps; STAMP=$(date +%F-%H%M); mkdir -p "$OUT"
pg_dump -Fc "$DATABASE_URL" -f "$OUT/app_scgss-$STAMP.dump"           # consistent snapshot while the service is running
tar -C "$D" -cf "$OUT/app_scgss-files-$STAMP.tar" files
for f in "$OUT/app_scgss-$STAMP.dump" "$OUT/app_scgss-files-$STAMP.tar"; do age -r "$AGE_PUBLIC_KEY" -o "$f.age" "$f"; rm "$f"; rclone copy "$f.age" "$RCLONE_DEST"; done
find "$OUT" -mtime +14 -delete
# Restore test: age -d -i KEY file.dump.age > x.dump && pg_restore -d <empty database> x.dump
