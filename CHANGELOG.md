# CCS Grant Support Mockups (SCGSS): change log

Every version of the CCS Student Conference Grant Support System mockups, newest first, from the original artifact (1.0.0) to the current version. The same history is in the app, on the **Versions** tab.

Numbering: **Major** (2.0) means how people work changes; **Minor** (1.1) means new features or a new look that leave existing steps alone; **Patch** (1.1.1) means fixes only. Status is Concept, Prototype, Pilot or Released. These numbers were assigned afterwards: the project had no version numbers before 1.2.0.

## Where each version came from

| Version | Date | Source |
|---|---|---|
| 1.0.0 | 12 Oct 2026 | Written in claude.ai as the CCS Grant Support Mockups artifact, last updated 12 Oct. Copied into GitHub on 15 Oct at 00:50 as one commit (5756603), so edits before that are not recorded. |
| 1.1.0 to 1.1.2 | 15 Oct 2026 | GitHub. One commit each, listed below. |
| 1.2.0 | 15 Oct 2026 | GitHub. This version history change. |
| 1.3.0 | 15 Oct 2026 | GitHub. Sign-in first and role tabs. |
| 2.0.0 | 15 Oct 2026 | GitHub. Working routing, approvals, post-activity reports and Google records. |
| 2.0.1 | 15 Oct 2026 | GitHub. Report template wording. |
| 2.1.0 | 18 Oct 2026 | GitHub. CCS Portal colors. |
| 3.0.0 | 20 Oct 2026 | GitHub. Feedback round: reimbursement, Dean approval, RFP and reminders. |
| 3.0.1 | 20 Oct 2026 | GitHub. Messages and Documents layout fixes. |
| 3.0.2 | 20 Oct 2026 | GitHub. Expense table on phones. |
| 3.1.0 | 22 Oct 2026 | GitHub. Event location limits, one grant amount, signer rules, signed report download. |

# Versions

## 3.1.0 (22 Oct 2026 · Prototype · current)

University grant limits by event location, one grant amount from the Dean, new rules when the Thesis Adviser is also a signatory, and one signed report download.

### Added

- **Event location** replaces local or international, with the University limits: NCR ₱6,000, Luzon (outside NCR) ₱8,000, Ilocos, Cagayan or Bicol ₱10,000, Visayas or Mindanao ₱12,000, international ₱15,000.
- **Clarify with the Dean**: the Administrative Assistant can ask about a funding source or a final approved amount from the Verification screen; the Dean replies in Messages and the answer shows in the same card.
- Dashboards list messages waiting for your reply, and a reply goes to the last person who wrote.
- The reimbursement report PDF has real text, complete table borders and the Dean's signature.

### Changed

- **The Dean sets one approved amount and one funding source** for the whole grant. The Administrative Assistant breaks it down by receipt at reimbursement and sets the funding source per item.
- Signer overlaps: adviser is the Department Chair, the Associate Dean endorses next; adviser is the Associate Dean, the file goes to the Dean; adviser is the Dean, the Associate Dean approves the grant in the Dean's place.
- One button, **Download Reimbursement Report**. Print or save as PDF and Download CSV were removed from the report page.
- The alternate approver for the Dean was removed from Settings.

### Known limits

- Applications already saved in a browser keep their data. Earlier local events are treated as Luzon (₱8,000).
- Luzon is assumed to mean Luzon outside NCR, Ilocos, Cagayan and Bicol. Please confirm.

## 3.0.2 (20 Oct 2026 · Prototype · commit 320b0c5)

Phone layout fix.

### Fixed

- The expense table on the application page turns into one card per expense on phones, so the Approved and Funding source columns are no longer cut off. The Dean can fill the amounts and funding sources there too.

## 3.0.1 (20 Oct 2026 · Prototype · commit d86073e)

Layout fixes on the application page.

### Fixed

- **Send to** in Messages: recipients are compact tick buttons that wrap, instead of wide boxes with text pushed to the side.
- **Documents** are a list of cards with Preview and Download always visible, instead of a table that scrolled sideways.

## 3.0.0 (20 Oct 2026 · Prototype)

The feedback round on reimbursement, the Dean's approval and the FAO. Because how people work changes (receipts are itemised, the Dean confirms before signing, the Administrative Assistant records an RFP, the report deadline is 15 days with automatic reminders, and the Secretary role is gone), this is a major version.

### Added

- **Receipts list** in the post-activity report: expense, OR or invoice no., merchant and amount. The total cannot be above the approved grant: Submit is disabled and the rule is checked again on submit.
- **Dean's confirmation**: Review and approve opens a summary (lines, total against the limit, signature) with Confirm approval. The funding source is typed on each line of the breakdown; a line can be 0. The signature can be drawn or uploaded.
- **RFP number** when the report is filed at the FAO. The student is notified (email and in-app) that the request was processed and may check with the FAO after 5 to 10 working days.
- **Download Reimbursement Report** (PDF) as soon as the amounts are verified, in the verification screen and in the report tab.
- **Period filter** (academic year and term) on the Dean, approver and staff dashboards. An RFP column in the dashboard, the tracking table and the Google Sheet.
- **Automatic reminders** to students for the post-activity report and reimbursement requirements, by email and in-app, at 15, 7, 3 and 1 days before the due date, on the due date, and every 3 days when overdue.
- **Return requirements**: the Administrative Assistant flags which documents to clarify or resubmit, and the student sees the list.
- **Send to** in Messages and clarifications: the Administrative Assistant can write to the student, any signatory and the Dean on any application.
- **Adviser who is also a signatory**: the adviser list includes the Chair, Associate Dean and Dean. A person endorses once and a repeated step is skipped. If the Dean is the adviser, the alternate approver from Settings approves the grant. An adviser demo in the Simulation tab.
- **Review and suggestions** tab: where each feedback item is, eight suggestions (including DocuSeal) and seven questions.

### Changed

- The proposed budget is blocked above ₱30,000 (international) or ₱15,000 (local).
- The student sees only the approved grant when reporting. Amounts are in pesos.
- The Administrative Assistant sees the total grant first and can correct the amount, funding source, OR or invoice no. and merchant of each item, with a remark.
- The reimbursement report shows only the final approved amounts.
- The post-activity report is due 15 days after the event (was 7 working days).
- A corrected report is saved as a new version (v2); the original stays on record.
- "Accounting Office" is now "FAO".
- Data is stored under a new key, so earlier demo data in the browser is replaced by the new sample data.

### Removed

- The currency dropdown and the conversion rate field.
- The funding source from the Dean's final decision, the funding source list in Settings, and every funding dropdown.
- "Documents verified" from the reimbursement report, and the claimed, rate and unused balance columns.
- The Secretary role and account.

### Known limits

- The downloaded report is a plain text PDF; the printed copy carries the Dean's signature image.
- Reminders run when the app is opened. The real build needs a daily job.
- DocuSeal is a suggestion only; nothing is built.
- Several rules are proposals to confirm: see Review & suggestions.

## 2.1.0 (18 Oct 2026 · Prototype)

The colors now match the CCS Portal website. Every feature works as before.

### Changed

- Light and dark colors follow the portal palette: Ink, Forest, Mint, Paper and Amber. Text, lines and surfaces are slightly different shades; the green accent is unchanged.
- The header version tag now reads v2.1.0.

## 2.0.1 (15 Oct 2026 · Prototype)

Wording fixes only.

### Changed

- The reimbursement report is now described as template v1, to be polished by the College. It no longer refers to an Accounting Office template.
- BSIS is confirmed as the third degree program.

## 2.0.0 (15 Oct 2026 · Prototype · commit 027093f)

A working simulation. One application now travels through every role, with real routing rules, notifications, a post-activity report, verification and a reimbursement report. Because how people work changes (a new routing order, a Dean e-signature and a new verification step), this is a major version.

### Added

- **Routing engine**: Thesis Adviser (set in the form), Department Chair (set by degree program), Associate Dean (set once in Settings), then Dean. Each step starts automatically after the previous decision, with an email and an in-app notice.
- **Endorse, Return with remarks, Reject.** Return keeps earlier decisions and goes back to the same approver after the student resubmits. Reject needs a reason and closes the application.
- **Dean approval** with an approved amount and funding source per expense line, capped at ₱30,000 international or ₱15,000 local, and a drawn digital signature.
- **Comments and clarifications** between the student and the approvers, with file uploads.
- **Document preview** on the page for every approver; each preview is written to the history.
- **Post-activity report**: actual expenses on the five pre-defined lines, peso conversion rate, a checklist of the nine post-conference documents, and one consolidated PDF.
- **Verification** by the Administrative Assistant: tick each document found in the PDF, add remarks, set the approved amount and funding source per item, then verify or return.
- **Reimbursement report** for the Accounting Office, printable to PDF, with a CSV download.
- **Dashboards** with Assigned, Pending, Approved, Returned and Rejected for approvers and staff, and a progress bar for students.
- **Approval History** for every update, including denied attempts.
- **Sheet & Drive** view of what the Google Sheet row and Drive folder hold, and `google/Code.gs`, an Apps Script that writes the real rows, files and emails.
- **Settings** for routing, funding sources and the Google link; **Simulation** with a full demo, security checks and a reminder check; seeded applications at every stage; a Notifications tab; a Tracking tab with filters and CSV export.
- Data Privacy consent (a draft notice for the Data Protection Officer to review), Thesis Adviser, academic year and term fields, and a confirmation that all requirements are in one PDF.

### Changed

- **Department is now Degree Program** (BSCS, BSIT, BSIS).
- References and file names follow `AY-Term-Number`, for example `2627-Term1-001` (`-v2` for new versions, `-C1` for clarification files, `-PAR` for post-activity reports).
- The dashboards, tracking table, verification and report read live data instead of fixed samples. Data is saved in the browser.
- The Dean's final-amount step was removed: the Dean sets the grant, and the Administrative Assistant sets the reimbursement.
- Review & suggestions was rewritten around these changes.

### Known limits

- Data lives in one browser; sign out and in to switch roles. Google sync only runs when a script URL is set.
- The reimbursement report is template v1; the College will polish it.
- The drawn signature is not a certified digital signature. The 7-working-day deadline skips weekends, not holidays.

## 1.3.0 (15 Oct 2026 · Prototype · commit 2cb28a6)

The app now opens on a sign-in screen, then on a dashboard that matches the role. Tabs are grouped by role, and Review & suggestions moves to the end, just before Versions.

### Added

- **Sign-in screen** with eight sample accounts (student, adviser, chair, associate dean, dean, administrative assistant, secretary, project owner). Password `demo`.
- The signed-in person shows in the header with a **Sign out** button.
- Each role opens on its own **dashboard**: student, approver or admin staff.

### Changed

- Dashboards is now the first tab. **Review & suggestions** is the last tab before Versions.
- Each role sees only the tabs it needs. The project owner account sees all of them.
- Header matches CCS Task Tracker: logo mark, version tag, subtitle and green favicon.

### Known limits

- The password is a fixed demo value and roles are not enforced on a server. This is a prototype.

## 1.2.0 (15 Oct 2026 · Prototype)

The full version history is recorded in the app, so any past change can be looked up here.

### Added

- **Versions** tab with the numbering rules, a table of where each version came from, every version since the original, and the change log by commit.
- A `CHANGELOG.md` file in the repository with the same history, readable on GitHub.
- The version number in the header.

## 1.1.2 (15 Oct 2026 · Prototype · commit 8a1eac1)

Fixes for phones.

### Fixed

- The tab strip sits in a sticky frosted bar, so page text no longer shows above it.
- Buttons and chips are larger to tap on touch screens.
- The verification list stacks into rows on phones, so Verify and Return can be reached. The toast is no longer squeezed.
- An inline favicon replaces the missing one (no more 404 in the console).

## 1.1.1 (15 Oct 2026 · Prototype · commit 2e40619)

Colors and the theme switch now come from one shared stylesheet.

### Changed

- Colors, shadows, easing, type and the theme switch styles load from `ccs-design/ccs-tokens.css`, also used by CCS Task Tracker. This file keeps a few older variable names as aliases of the shared ones.
- The resolved colors were checked and are identical to 1.1.0 in light and dark.

### Known limits

- The page needs a network connection to load the shared stylesheet. Opened offline, it loses its colors.

## 1.1.0 (15 Oct 2026 · Prototype · commit 8a2df7c)

A visual refresh in the style of a macOS app, matching CCS Task Tracker 2.5. Every feature works as before.

### Added

- **Dark theme** and a **theme switch** in the header: System, Light or Dark. The choice is remembered in this browser.
- Motion that answers a press: press feedback 160ms, toasts 240ms in and 160ms out. Tab switches do not animate.
- With Reduce motion turned on, movement is replaced by a 120ms fade.

### Changed

- New look: neutral surfaces, one blue accent, a frosted toolbar and segmented tabs. The system font replaces the downloaded fonts.
- On phones the header scrolls away and only the tab strip stays pinned.
- The tab strip scrolls sideways when it does not fit.

### Fixed

- Text in the Workflow diagram no longer runs past the edge of its boxes.
- Progress steps inside cards stack correctly, pills no longer stretch, and small tables are no longer clipped.

## 1.0.0 (12 Oct 2026 · Prototype · commit 5756603)

The original CCS Grant Support Mockups: ten tabs of mockups and a working simulation, with fictional sample data.

### Added

- Ten tabs: Review & suggestions, Dashboards, Guidelines, Application form, Workflow, Tracking table, Verification, FAO report, Simulation and Scenarios.
- Dashboards for the student, the approver (Department Chair) and the admin staff.
- Application form in five steps, built from the paper form, with an example you can fill in.
- Approval and reimbursement workflow diagram and a who-may-do-what table.
- Document verification, FAO report draft, and a step-by-step simulation with scenarios.
- A green color scheme with Newsreader and IBM Plex fonts, following the device light or dark setting.

### Known limits

- The tracking spreadsheet and the FAO template were not supplied, so the FAO report is a draft placeholder.
- Earlier edits made in claude.ai before 12 Oct were not kept. This is the first version on record.

# Change log by commit

Every commit in the GitHub history, newest first. The version 1.2.0 commit is added when it is published.

| Commit | When (UTC+8) | Version | Change |
|---|---|---|---|
| [8a1eac1](https://github.com/zefanonuevo/ccs-scgss/commit/8a1eac1) | 15 Oct 01:21 | 1.1.2 | Mobile fixes: pinned tab bar, touch targets, favicon, verification list. |
| [2e40619](https://github.com/zefanonuevo/ccs-scgss/commit/2e40619) | 15 Oct 01:09 | 1.1.1 | Load design tokens from the shared ccs-design stylesheet. |
| [8a2df7c](https://github.com/zefanonuevo/ccs-scgss/commit/8a2df7c) | 15 Oct 00:53 | 1.1.0 | Redesign as a macOS-style app, matching CCS Task Tracker. |
| [5756603](https://github.com/zefanonuevo/ccs-scgss/commit/5756603) | 15 Oct 00:50 | 1.0.0 | Added CCS Grant Support Mockups (original artifact) to GitHub. |
