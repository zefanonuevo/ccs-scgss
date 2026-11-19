# SCGSS QA Test Plan (v1.0)

Run this after every install or update, on the live VM or a test copy, with test accounts only. Record pass or fail and the date. A failed line blocks go-live.

**You need:** two student accounts, one Thesis Adviser, the Chair of that student's department, the Associate Dean, the Dean, the Administrative Assistant and the System Administrator. Three small PDFs, one PNG or JPG graphic, a text of about 350 words, and one text file renamed to `fake.pdf`.

## A. Install and access
| # | Step | Expected |
|---|---|---|
| A1 | `curl http://<private-ip>:3001/healthz` | `ok` |
| A2 | Open the page signed out of the portal | "Sign in to the CCS portal first" |
| A3 | Sign in with a DLSU account that is not listed (staff style email) | 403 "Your account is not set up" |
| A4 | Sign in as a new student-style email | Added as Student on first visit |
| A5 | Open the Roles tab as a student | Refused. As System Administrator: it opens |
| A6 | Header version tag | Matches `CHANGELOG.md` |

## B. Application flow
| # | Step | Expected |
|---|---|---|
| B1 | Student submits without the privacy box ticked | Refused with a message |
| B2 | Student submits with a PDF, adviser chosen | Reference like `2627-Term1-001`; adviser notified |
| B3 | Adviser, Chair, Associate Dean endorse | Each step moves forward and is recorded in history |
| B4 | Dean enters one amount above the location limit | Refused. At or below the limit: approved, with no signature asked |
| B5 | Dean as the student's adviser | Associate Dean approves in the Dean's place, no endorsement step |
| B6 | Chair as the adviser | Chair step skipped, Associate Dean next |
| B7 | Return with remarks, student resubmits | Earlier decisions kept, cycle goes up |
| B8 | Reject | Application closed, student told the reason |
| B9 | Application form, Expenses step | Four expense rows: Registration fee, Pre-departure fees, Roundtrip airfare, Accommodation. No Per diem |
| B9a | Post-activity report page | Expense button reads **Add an expense**; no Per diem in the list; checklist shows the six documents numbered in order: proof of acceptance or invitation, official receipts or invoices, billing statements, itinerary receipts, peso conversion rate, Student ID |
| B9b | Untick one document and leave the explanation empty, submit | Refused: asks for the explanation. With an explanation: accepted |
| B9c | Submit without the Post-Conference Report, or without the graphic | Refused |
| B9d | Article summary of 299 words, then 501 words | Refused both times; the counter shows how many words to add or remove. 300 to 500: accepted |
| B9e | Article location | Filled in from the application and cannot be edited |
| B9f | Submit all three uploads | Saved as `<ref>-PAR.pdf`, `<ref>-PCR.pdf`, `<ref>-GRAPHIC.<ext>`; Administrative Assistant notified |
| B9g | Administrative Assistant returns it for the article only; student fixes the article and resubmits without new files | Accepted; earlier PDFs kept; version 2 |
| B9h | Application page and verification screen | Article text and graphic shown, with Preview and Download |
| B10 | Administrative Assistant verifies, sets approved amount per item, sends the summary to the Dean | Checklist has eight rows (six documents, Post-Conference Report, article and graphic); each needs a tick or a remark. Total shown, student notified |
| B11 | "Clarify with the Dean" | Dean receives the question and can reply |
| B11a | Before the Dean approves | Summary of Expenses tab: not listed, no Download or Print; Mark filed at FAO refused |
| B11b | Dean opens the application from Pending, reads the full summary, approves without a signature | Refused: asks for the signature |
| B11c | Dean returns it with remarks | Back on the Verification screen with the Dean's remarks; Administrative Assistant notified |
| B11d | Dean signs (draw, upload, or saved) and confirms | Status "Summary of Expenses approved"; Administrative Assistant and student notified |
| B12 | Download and Print the Summary of Expenses | One PDF titled "Student Conference Grant / Summary of Expenses", laid out as the College's form: details, Total Approved Grant and Funding Source, Endorsements and Approval, the expense table with Total Approved Amount for Reimbursement, Prepared by (Administrative Assistant) and Verified and Approved by (Dean's signature, name, title, date) |
| B13 | File at FAO with an RFP number | Status "Filed at FAO". The student's email starts "Hi <first name MI surname>, Good day!", gives the RFP reference number, Window A or B, Finance Office at St. La Salle Hall, 5 to 10 business days, and the reminder about original receipts or invoices |

## C. Google link
| # | Step | Expected |
|---|---|---|
| C1 | After B2, within a minute | Row in the `Applications` tab; PDF in Drive under `Applications/<year-term>` |
| C1a | After B9f | The three post-activity files in Drive under `Post-activity/<year-term>`; the row has the Article columns (title, date, location, summary, words) |
| C2 | After each stage change | Same row updates, no duplicate row |
| C3 | Server log | No `[gas] rejected` or `[gas] failed` lines |
| C4 | Email to the adviser | From "CCS Student Grants (SCGSS)"; ends with applicant, reference, event, location, dates, status, confidentiality line; no amounts |

## D. Privacy and security
| # | Step | Expected |
|---|---|---|
| D1 | The form's notice | Names the data, purposes, recipients, Google and cross-border processing, retention, rights, how to complain to the NPC |
| D2 | Look in the application record | Consent time and notice version stored |
| D3 | A second student opens the first student's file address | 404 |
| D4 | An approver who is not on that application opens the file | 404 |
| D4a | The second student submits an application naming the first student's file id (developer tools, edit the request) | Refused; the first student can still open the file (fixed in 1.0.0-rc.4) |
| D4b | New uploads | File ids are long random strings, not `f1`, `f2` |
| D5 | Upload `fake.pdf` (text renamed) | Refused: content does not match |
| D6 | Upload a `.exe` | Refused: type not accepted |
| D7 | Upload a file over 20 MB | Refused |
| D8 | Open and download a file, then `node users.js audit 10` | `file_view` and `file_download` rows with email and application |
| D9 | `node users.js export <student email>` | JSON with applications, files, notices, access log; no signature image |
| D10 | Set `AUDIT_KEEP_DAYS=1`, restart (test copy only) | Old rows deleted, `[privacy]` line in the log |
| D11 | Browser developer tools, response headers | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` present |
| D12 | Post from another website (or `curl` with a different `Origin`) | 403 |

## E. Phones and print
| # | Step | Expected |
|---|---|---|
| E1 | Dashboard at 375 px wide | No overlapping boxes, no sideways scrolling |
| E2 | Application form and Documents table on a phone | Readable, stacked |
| E3 | Print or download reports | Text not cut off |

## F. Recovery
| # | Step | Expected |
|---|---|---|
| F1 | `sudo systemctl restart app@scgss` | All applications still there |
| F2 | Run the backup script, restore it into a throwaway database | Counts match |

## Automated tests
`cd server && TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/postgres npm test` needs a PostgreSQL test database. 19 tests (1.0.0-rc.6). They cover sign-in and roles, a whole application to filing, restart persistence, file access, the origin check, roles screen safeguards, signer overlaps, the public file list, the access list CSV, file ownership (a file can be attached only by its uploader, once), and the post-activity report (three uploads, article word limits, missing documents with an explanation, no Per diem, resubmission keeping earlier files, and the RFP email text), and the Dean's approval of the Summary of Expenses (no signature on the grant, approval only by the Dean with a PNG signature, return with remarks, no filing before approval). They do not cover the Google link, the privacy checks D5 and D8 to D10, or the layout.
