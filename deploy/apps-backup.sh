#!/usr/bin/env bash
# Nightly backup of SCGSS on the apps VM (SCGSS Backend Setup Guide, step 13, adapted: this app keeps its database in SQLite and its
# uploaded files on this VM's disk, so both are backed up). Run from a systemd timer or cron as a user that can read /srv/apps/scgss/data.
# Needs: sqlite3, age, rclone (configured for the Shared Drive). AGE_PUBLIC_KEY is the PUBLIC key; keep the private key elsewhere.
set -euo pipefail
: "${AGE_PUBLIC_KEY:?set AGE_PUBLIC_KEY}"; : "${RCLONE_DEST:=gdrive-shared:Backups/}"
D=/srv/apps/scgss/data; OUT=/var/backups/apps; STAMP=$(date +%F-%H%M); mkdir -p "$OUT"
sqlite3 "$D/scgss.db" ".backup '$OUT/app_scgss-$STAMP.db'"            # consistent copy while the service is running
tar -C "$D" -cf "$OUT/app_scgss-files-$STAMP.tar" files
for f in "$OUT/app_scgss-$STAMP.db" "$OUT/app_scgss-files-$STAMP.tar"; do age -r "$AGE_PUBLIC_KEY" -o "$f.age" "$f"; rm "$f"; rclone copy "$f.age" "$RCLONE_DEST"; done
find "$OUT" -mtime +14 -delete
