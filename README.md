# CCS Student Conference Grant Support System (SCGSS)

Student conference grants for the College of Computer Studies: application form, automatic routing (Thesis Adviser, Department Chair, Associate Dean, Dean), post-activity report with itemised receipts, document verification, the reimbursement report, and filing at the FAO with an RFP number.

**Version 4.x is a real system**, not the browser simulation of 3.x. The rules, records and files live on a server on the CCS apps VM. Sign-in is the CCS portal's Google sign-in; what a person may do comes from this system's own Roles table.

- `shared/rules.js`: constants, status helpers and form validation, used by both the server and the page.
- `server/`: Node.js, Express and PostgreSQL. `engine.js` (approval rules), `app.js` (HTTP), `db.js` (storage and roles), `users.js` (command-line roles tool), `test/`.
- `js/`, `index.html`: the screens. They keep no data; they call the server.
- `google/Code.gs`: Apps Script that writes the Sheet row, saves files in Drive and sends email. Only the server calls it.
- `deploy/`, `docs/DEPLOY.md`: install and update on the apps VM, Apache path, backups, troubleshooting.
- `docs/USER-MANUAL.md` (students, approvers, staff), `docs/QA-TEST-PLAN.md` (checks after each install), `docs/DATA-PRIVACY.md` (privacy paper for the Data Protection Officer).

## Roles
student, adviser, chair (one per program), assoc (Associate Dean), dean, admin (Administrative Assistant), sysadmin. People are added on the **Roles** tab (or `node server/users.js add <email> <role> [name] [program]`). A signed-in DLSU account with no row is refused.

## Run it locally
`cd server && npm ci && npm test`. The tests use a stub in place of the portal sign-in. The earlier simulation (3.1.2) is still on the `main` branch and at https://zefanonuevo.github.io/ccs-scgss/ until this branch is merged.

## Version history
Every version is in [CHANGELOG.md](CHANGELOG.md) and in the app on the **Versions** tab.

## Design system
Same macOS-style design as [ccs-task-tracker](https://github.com/zefanonuevo/ccs-task-tracker). Colors, shadows, easing, type and the theme switch load from the shared stylesheet in [ccs-design](https://github.com/zefanonuevo/ccs-design); the page needs a network connection to load it.
