# Deploying SCGSS v4.0

Status: **Proposed. Written and tested against a stubbed portal sign-in. Not yet run on the VM.** Follows the *SCGSS Backend Setup Guide* (30 Oct 2026) and its architecture diagram: portal VM (Apache, portal sign-in) in front, one apps VM on a private VLAN, one service per app with its own database and port.

## What runs where
```
Browser -> Apache on the portal VM (https://ccs.dlsu.edu.ph/scgss/)  -- ProxyPass -->  apps VM, private address, port 3001 (service app@scgss)
                                                                                      |-- PostgreSQL database app_scgss (this VM, 127.0.0.1:5432) and uploaded files in /srv/apps/scgss/data
                                                                                      |-- asks https://ccs.dlsu.edu.ph/api/me "who is signed in?" (forwards the browser's portal cookie)
                                                                                      '-- Google Apps Script (Sheet row, Drive copy, email) using GAS_URL and GAS_TOKEN
```
- **Sign-in is the portal's.** SCGSS has no sign-in page. If the portal cookie is missing the page says to sign in to the portal first.
- **Access is SCGSS's own.** The signed-in email must be an active row in the `scgss_users` table, or the server answers 403. Roles: student, adviser, chair (per program), assoc (Associate Dean), dean, admin (Administrative Assistant), sysadmin. The System Administrator edits them on the **Roles** tab. One Dean, one Associate Dean and one chair per program can be active.
- **Rules** (routing, signer overlaps, grant limits, reimbursement checks, reminders) run on the server in `server/engine.js`, copied from the prototype's `js/core.js` v3.1.2. Every action is checked against the person's role.
- **Differences from the guide, by choice:** files on the apps VM disk (the guide's own fallback while the Data Protection Officer's answer is open) with a copy sent to Drive by Apps Script; email through Apps Script, not the Gmail API.

## Steps (you run them; nothing here changes a VM by itself)
**1. Apps VM** (Ubuntu 24.04): install Node.js 22 LTS, `git`, `postgresql` (16), `age`, `rclone`. Firewall: allow TCP 3001 only from the portal VM; SSH only from the admin network.

**2. Database** (as guide step 2; one database and one login per app). As the `postgres` user, with a long random password of your own:
```
sudo -u postgres psql -c "CREATE ROLE app_scgss LOGIN PASSWORD '<long random>';"
sudo -u postgres psql -c "CREATE DATABASE app_scgss OWNER app_scgss;"
sudo -u postgres psql -c "REVOKE ALL ON DATABASE app_scgss FROM PUBLIC;"
```
PostgreSQL listens on 127.0.0.1 only. The tables (including `scgss_users`) are created by the app on first start.

**3. Install** on the apps VM, as root, after reading it: `sudo bash deploy/setup-scgss.sh` (set `BRANCH=backend` until the branch is merged). It creates the `app_scgss` user, `/srv/apps/scgss`, the service template and the settings file.

**4. Settings:** edit `/etc/apps/scgss.env`: set `DATABASE_URL=postgres://app_scgss:<password>@127.0.0.1:5432/app_scgss`, `HOST` to the apps VM's private address, and `GAS_URL`/`GAS_TOKEN` (see `google/Code.gs`). Leave Google empty to run without it.

**5. First administrator and start:**
```
sudo -u app_scgss bash -c 'set -a; . /etc/apps/scgss.env; node /srv/apps/scgss/current/server/users.js add YOU@dlsu.edu.ph sysadmin "Your Name"'
sudo systemctl enable --now app@scgss
curl http://<apps-vm-private-ip>:3001/healthz        # prints ok
```

**6. Apache on the portal VM:** copy `deploy/apache-app-scgss.conf` to `/etc/apache2/conf-available/app-scgss.conf`, put in the apps VM's private address, add `IncludeOptional conf-available/app-scgss.conf` **inside the portal's HTTPS virtual host above** `ProxyPass / ...`, then `sudo apache2ctl configtest && sudo systemctl reload apache2`. Take a Proxmox snapshot first; the portal is production.

**7. Roles:** sign in to the portal, open `/scgss/`, then **Roles** and add the Dean, Associate Dean, a chair for each of BSCS, BSIT and BSIS, the Administrative Assistant, advisers and students. Students' emails look like `juan_dela_cruz@dlsu.edu.ph`, staff like `maria.delacruz@dlsu.edu.ph`. Applications cannot be submitted until every signer exists.

**8. Backups:** schedule `deploy/apps-backup.sh` nightly (`pg_dump` of the database *and* the files folder, encrypted, copied to Drive). Keep the `age` private key off the server. Do one restore test before go-live.

## Check after install
- Signed out: `/scgss/` shows "Sign in to the CCS portal first". A DLSU account with no row shows "Your account is not set up yet" (403).
- Roles tab works for the System Administrator and is refused for everyone else.
- A test application goes from student to Dean to the Administrative Assistant and is filed with an RFP number.
- From a student-network machine, `http://<apps-vm-private-ip>:3001/` is unreachable.

## Updating
`sudo bash deploy/setup-scgss.sh` again (pulls, installs, keeps your settings), then `sudo systemctl restart app@scgss`.

## What was and was not tested
Tested: `cd server && TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/postgres npm test` against a throwaway PostgreSQL 16 (each test uses its own schema; 9 tests over real HTTP with a stubbed portal sign-in: sign-in and role gating, a whole application to filing, restart persistence (reloaded from PostgreSQL), file access, origin check, roles screen safeguards, signer overlaps, public file list) and a simulated-browser load of the page for each role. **Not tested:** the real portal `/api/me`, Apache, the firewall, the Apps Script link, the backup script, real PDFs from a browser upload, and any phone or desktop layout check.
