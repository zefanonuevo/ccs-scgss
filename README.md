# CCS Student Conference Grant Support System (SCGSS)

A working simulation of the CCS student conference grant process: application form, automatic routing (Thesis Adviser, Department Chair, Associate Dean, Dean), post-activity report, document verification, and the reimbursement report.

**Live:** https://zefanonuevo.github.io/ccs-scgss/ (or open `index.html` in a browser while online)

- All names, amounts, dates and links are fictional sample data.
- Nothing here is a deployed system. Everything runs in your browser and is saved there. Nothing is sent anywhere unless you set a Google Apps Script URL in Settings.
- Anything not stated in the supplied application form and guidelines is marked as an assumption to confirm.

## Try it

Open the live page, sign in with a sample account (password `demo`) and follow one application across roles. The **Simulation** tab runs a whole application in one click.

| Role | Account |
|---|---|
| Student | maria.santos@college.example, noel.ramos@college.example |
| Thesis Adviser | adviser.reyes@college.example, adviser.villanueva@college.example |
| Department Chair | chair.cs@, chair.it@, chair.is@college.example |
| Associate Dean, Dean | assoc.dean@, dean@college.example |
| Administrative Assistant | admin.assistant@college.example |
| Secretary | secretary@college.example |
| System Administrator | sysadmin@college.example (sees every tab) |

## Files

- `index.html`: layout and styles.
- `js/core.js`: data, routing and approval rules, notifications, seed data.
- `js/ui.js`, `js/ui2.js`: the screens.
- `google/Code.gs`: Apps Script that writes the Google Sheet row, saves files in the Drive folder and sends email. Setup steps are at the top of the file.

## Version history

Every version since the start is in [CHANGELOG.md](CHANGELOG.md) and in the app on the **Versions** tab.

## Design system

Same macOS-style design as [ccs-task-tracker](https://github.com/zefanonuevo/ccs-task-tracker): system font stack, frosted toolbar, segmented tabs, and a System, Light or Dark theme switch.

Colors, shadows, easing, type and the theme switch styles load from the shared stylesheet in [ccs-design](https://github.com/zefanonuevo/ccs-design). This file keeps a few older variable names as aliases of the shared ones.

- Press feedback 160ms, toasts 240ms in and 160ms out, no animation on tab switches, reduced motion becomes a 120ms fade.
- The header scrolls away on phones and only the tab strip stays pinned.

The page needs a network connection to load the shared stylesheet. Opened offline, it loses its colors.
