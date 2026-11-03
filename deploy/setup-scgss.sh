#!/usr/bin/env bash
# Run ON THE APPS VM as root, after reading it. First-time setup of SCGSS following the SCGSS Backend Setup Guide, section 5.
# It creates the user and folders, installs the code and the service. It does not touch the firewall, Apache or Google.
set -euo pipefail
NAME=scgss
REPO=https://github.com/zefanonuevo/ccs-scgss
BRANCH=${BRANCH:-main}
command -v psql >/dev/null || { echo "Install PostgreSQL first and create the app_scgss database (docs/DEPLOY.md step 2)."; exit 1; }
command -v node >/dev/null || { echo "Install Node.js 22 LTS first (see docs/DEPLOY.md)."; exit 1; }
id "app_$NAME" >/dev/null 2>&1 || useradd --system --home-dir "/srv/apps/$NAME" --shell /usr/sbin/nologin "app_$NAME"
mkdir -p "/srv/apps/$NAME/data" /etc/apps
if [ -d "/srv/apps/$NAME/current/.git" ]; then git -C "/srv/apps/$NAME/current" fetch origin "$BRANCH" && git -C "/srv/apps/$NAME/current" checkout "$BRANCH" && git -C "/srv/apps/$NAME/current" pull --ff-only
else git clone --branch "$BRANCH" "$REPO" "/srv/apps/$NAME/current"; fi
( cd "/srv/apps/$NAME/current/server" && npm ci --omit=dev )
chown -R root:root "/srv/apps/$NAME/current"
chown -R "app_$NAME:app_$NAME" "/srv/apps/$NAME/data"
if [ ! -f "/etc/apps/$NAME.env" ]; then
  cp "/srv/apps/$NAME/current/server/.env.example" "/etc/apps/$NAME.env"
  chown root:"app_$NAME" "/etc/apps/$NAME.env"; chmod 640 "/etc/apps/$NAME.env"
  echo ">> Edit /etc/apps/$NAME.env now (DATABASE_URL, HOST, GAS_URL, GAS_TOKEN)."
fi
cp "/srv/apps/$NAME/current/deploy/app@.service" /etc/systemd/system/app@.service
mkdir -p "/etc/systemd/system/app@$NAME.service.d"
cp "/srv/apps/$NAME/current/deploy/app@scgss.service.d/override.conf" "/etc/systemd/system/app@$NAME.service.d/override.conf"
systemctl daemon-reload
echo "Next: add the first System Administrator, then start the service:"
echo "  sudo -u app_$NAME bash -c 'set -a; . /etc/apps/$NAME.env; node /srv/apps/$NAME/current/server/users.js add YOU@dlsu.edu.ph sysadmin \"Your Name\"'"
echo "  systemctl enable --now app@$NAME && journalctl -u app@$NAME -e"
