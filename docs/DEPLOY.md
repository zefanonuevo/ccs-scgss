# Deploying SCGSS v1.0

Read `docs/DATA-PRIVACY.md` first and get the University Data Protection Officer's approval of the notice **before real students use the system**. After install, run the checks in `docs/QA-TEST-PLAN.md`. People who use the system read `docs/USER-MANUAL.md`. The tables are described in `docs/DATABASE.md` and the process in `docs/WORKFLOW.md`.

Status: **Running on the CCS apps VM behind the portal (Nov 2026). The Google link (Sheet, Drive, email) is set up in step 4a.** Follows the *SCGSS Backend Setup Guide* (30 Oct 2026) and its architecture diagram: portal VM (Apache, portal sign-in) in front, one apps VM on a private VLAN, one service per app with its own database and port.

## What runs where
```
Browser -> Apache on the portal VM (https://ccs.dlsu.edu.ph/scgss/)  -- ProxyPass -->  apps VM, private address, port 3001 (service app@scgss)
                                                                                      |-- PostgreSQL database app_scgss (this VM, 127.0.0.1:5432) and uploaded files in /srv/apps/scgss/data
                                                                                      |-- asks https://ccs.dlsu.edu.ph/api/me "who is signed in?" (forwards the browser's portal cookie)
                                                                                      '-- Google Apps Script (Sheet row, Drive copy, email) using GAS_URL and GAS_TOKEN
```
- **Sign-in is the portal's.** SCGSS has no sign-in page. If the portal cookie is missing the page says to sign in to the portal first.
- **Access is SCGSS's own.** The signed-in email must be an active row in the `scgss_users` table, or the server answers 403. Roles: student, adviser, chair (per department), assoc (Associate Dean), dean, admin (Administrative Assistant), sysadmin. The System Administrator edits them on the **Roles** tab. One Dean, one Associate Dean and one chair per department can be active.
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

**4. Settings:** edit `/etc/apps/scgss.env`: set `DATABASE_URL=postgres://app_scgss:<password>@127.0.0.1:5432/app_scgss`, `HOST` to the apps VM's private address, and `GAS_URL`/`GAS_TOKEN` (step 4a). Leave Google empty to run without it.

**4a. Google link (Sheet, Drive, email).** Do all of it signed in as **computerstudies@dlsu.edu.ph**: emails are sent from the account that owns the script, and the Sheet and Drive folder belong to it.
1. Create a Google Sheet ("CCS SCGSS Applications") and a Drive folder ("CCS-SCGSS"); copy the folder ID from its URL.
2. In the Sheet: Extensions > Apps Script, paste all of `google/Code.gs`.
3. Project Settings > Script properties: `TOKEN` (long random string, `openssl rand -hex 32`), `FOLDER_ID` (the folder ID), `ALLOWED_DOMAIN` = `dlsu.edu.ph`.
4. Run `authorize` once and accept the Sheet, Drive and Mail permissions.
5. Deploy > New deployment > Web app: Execute as **Me**, Who has access **Anyone**. If "Anyone" is not offered, the university Workspace admin must allow it; the server is not signed in to Google and cannot call the script otherwise. Copy the `/exec` URL.
6. On the apps VM, put `GAS_URL=<the /exec URL>` and `GAS_TOKEN=<the TOKEN>` in `/etc/apps/scgss.env`, then `sudo systemctl restart app@scgss`.
7. Test (sends one email): `curl -sL -X POST "<GAS_URL>" -H "Content-Type: application/json" -d '{"token":"<TOKEN>","action":"email","to":"you@dlsu.edu.ph","subject":"SCGSS test","body":"It works."}'` must print `{"ok":true}`. Then submit a test application: a row appears in the "Applications" sheet and the file in Drive under Applications/<year-term>.

If Google is unreachable, SCGSS keeps working and the email stays in its outbox. A workspace account may send about 1,500 emails a day. Keep the token out of the repository and rotate it if it leaks (change it in Script properties and in `scgss.env`).

**5. First administrator and start:**
```
sudo -u app_scgss bash -c 'set -a; . /etc/apps/scgss.env; node /srv/apps/scgss/current/server/users.js add YOU@dlsu.edu.ph sysadmin "Your Name"'
sudo systemctl enable --now app@scgss
curl http://<apps-vm-private-ip>:3001/healthz        # prints ok
```

**6. Apache on the portal VM:** copy `deploy/apache-app-scgss.conf` to `/etc/apache2/conf-available/app-scgss.conf`, put in the apps VM's private address, add `IncludeOptional conf-available/app-scgss.conf` **inside the portal's HTTPS virtual host, after the `ProxyPass /.well-known/ !` line and above** `ProxyPass / ...` (in `/etc/apache2/sites-available/ccs-portal.conf`; the include also sets a Content-Security-Policy for `/scgss/` that allows `blob:` previews), then `sudo apache2ctl configtest && sudo systemctl reload apache2`. Take a Proxmox snapshot first; the portal is production.

**7. Roles:** staff are loaded from the access list CSV (lines `Role,email`, and for each Department Chair a third column with the department: DCT, DST or DIT). Copy the file to the apps VM (do not commit it: the repository is public) and run:
```
sudo -u app_scgss bash -c 'set -a; . /etc/apps/scgss.env; node /srv/apps/scgss/current/server/users.js import /tmp/scgss-access.csv'
```
One role per person: if someone is on the list more than once, the highest role wins (Dean, Associate Dean, Department Chair, Administrative Assistant, Thesis Adviser). A Chair can still be chosen as a Thesis Adviser. Names are made from the email; fix them on the **Roles** tab. Re-running the import is safe.
- **Students** with an email like `juan_dela_cruz@dlsu.edu.ph` (underscores, no dot) are added as Students on their first sign-in (`AUTO_STUDENTS=on`). Switch one off on the Roles tab and they stay off.
- **Staff** with an email like `maria.delacruz@dlsu.edu.ph` (a dot) must be on the list, or they get 403.
- **Degrees and chairs:** 10 degrees (BSCS-CSE, BSCS-NIS, BSCS-ST, BSDS, BSINFSC, BSIS, BSIET-AD, BSIET-GD, BSIT, BSMSCS) belong to three departments: DCT (BSCS-CSE, BSCS-NIS), DST (BSCS-ST, BSDS, BSIET-AD, BSIET-GD, BSMSCS), DIT (BSINFSC, BSIS, BSIT). An application goes to the chair of its degree's department. The table is in `shared/rules.js`.
**Later changes** are done on the **Roles** tab: Delete, tick boxes with Switch off / Switch on / Delete selected, and a CSV upload with a preview (add and update; replace the staff list; or delete everyone listed). Delete removes access and the person's saved draft and signature; applications and history stay. `users.js delete <email>` does one person from the command line.
Applications cannot be submitted until the Dean, Associate Dean and the chair of that department exist.

**8. Backups:** schedule `deploy/apps-backup.sh` nightly (`pg_dump` of the database *and* the files folder, encrypted, copied to Drive). Keep the `age` private key off the server. Do one restore test before go-live.

**9. Privacy settings (v1.0):** in `/etc/apps/scgss.env` set `AUDIT_KEEP_DAYS` (default 365; the notice tells students access logs are kept 12 months). The service deletes older access-log rows once a day. Then:
- Have the DPO approve the notice text in `shared/rules.js` (`PRIVACY`), add the DPO contact, and change `PRIVACY_VERSION` whenever the text changes. Each application stores the version the student accepted.
- Answer an access request (a person asking for their data) with: `sudo -u app_scgss bash -c 'set -a; . /etc/apps/scgss.env; node /srv/apps/scgss/current/server/users.js export person_name@dlsu.edu.ph'`. Send the output by a secure channel, never by ordinary email.
- Confirm the VM disk is encrypted and that MFA is on for the portal and the computerstudies@dlsu.edu.ph account (see `docs/DATA-PRIVACY.md`, section 9).

## Check after install
- Signed out: `/scgss/` shows "Sign in to the CCS portal first". A DLSU account with no row shows "Your account is not set up yet" (403).
- Roles tab works for the System Administrator and is refused for everyone else.
- A test application goes from student to Dean to the Administrative Assistant and is filed with an RFP number.
- The Google test in step 4a returns `{"ok":true}`, the email arrives from CCS Student Grants (SCGSS), and the test application shows in the Sheet and Drive.
- From a student-network machine, `http://<apps-vm-private-ip>:3001/` is unreachable.
- Privacy (v1.0): the form shows the new notice; a submitted application records the notice version; opening an uploaded file adds a `file_view` row in the access log (`node users.js audit 10`); renaming a program to `.pdf` is refused; an email ends with the applicant, reference, event, status and the confidentiality line.

## Updating
1. Take a database copy first: `sudo -u postgres pg_dump -Fc app_scgss -f /var/backups/app_scgss-before-update.dump` (delete it once the update is confirmed; it holds personal data). The nightly `deploy/apps-backup.sh` needs `AGE_PUBLIC_KEY` set, so it does not run as a bare command.
2. `cd /srv/apps/scgss/current && sudo BRANCH=backend bash deploy/setup-scgss.sh` (pulls, installs, keeps your settings).
3. `sudo systemctl restart app@scgss`, then `sudo systemctl status app@scgss --no-pager` must say `active (running)`.
4. `curl http://<apps-vm-private-ip>:3001/healthz` must print `ok`. Use the private address from `HOST` in `/etc/apps/scgss.env`: the service does not listen on `localhost`, so `curl http://localhost:3001/healthz` is expected to fail.
5. Open https://ccs.dlsu.edu.ph/scgss/ and press Ctrl+F5. The version tag in the header must match `CHANGELOG.md`.

**Going back** if an update misbehaves: `git log --oneline -5` on the VM, `sudo git checkout <previous commit>`, `sudo systemctl restart app@scgss`. New releases only add tables or columns, so older code still starts. If data was damaged, restore the nightly backup (see step 8) after one restore test.

## Troubleshooting (problems met in the first rollout)
| Symptom | Cause and fix |
|---|---|
| `curl localhost:3001/healthz` fails | Normal. Use the private address from `HOST`. If that also fails, `sudo journalctl -u app@scgss -e --no-pager`. |
| `psql: role "root" does not exist` | Do not run `psql` as root. Use `sudo -u postgres psql app_scgss`. Type the quotes exactly: `psql "$DATABASE_URL"` inside `bash -c`. |
| Header still shows the old version | Cloudflare or the browser cached the scripts. Hard refresh (Ctrl+F5). Script addresses carry a version that changes with each release. |
| Log says `Google sync off` | `GAS_URL` or `GAS_TOKEN` is empty in `/etc/apps/scgss.env`. Set both, restart. |
| Log says `[gas] rejected ... parent.mimeType` | `FOLDER_ID` in the Apps Script properties is not a normal folder (wrong ID, a shortcut, or a file). Copy the ID from the folder's address bar, after `/folders/`. |
| Apps Script **Executions** all say "Completed" but the Sheet and Drive stay empty | "Completed" only means the script ran. It catches its own errors. Read the `[gas]` lines in the server log, and look for an `Applications` tab at the bottom of the Sheet. |
| Sheet empty, no `Applications` tab | The script is not attached to that Sheet. Open the Sheet, Extensions, Apps Script, and paste `google/Code.gs` there. |
| An application submitted before Google was switched on is missing from Sheet and Drive | Nothing resends it yet (known gap). Submit a new test, or have the Administrative Assistant re-save it. |
| 403 "Your account is not set up" | The email is not in the Roles tab. Staff emails with a dot must be added by the System Administrator. |

## What was and was not tested
Tested: `cd server && TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/postgres npm test` against a throwaway PostgreSQL 16 (each test uses its own schema; 9 tests over real HTTP with a stubbed portal sign-in: sign-in and role gating, a whole application to filing, restart persistence (reloaded from PostgreSQL), file access, origin check, roles screen safeguards, signer overlaps, public file list) and a simulated-browser load of the page for each role. **Not tested by me:** the Apps Script link on the live account, the firewall, the backup script, real PDFs from a browser upload, and any phone or desktop layout check.
