# SCGSS QA Test Plan (v4.2)

Run this after every install or update, on the live VM or a test copy, with test accounts only. Record pass or fail and the date. A failed line blocks go-live.

**You need:** one student account, one Thesis Adviser, the Chair of that student's department, the Associate Dean, the Dean, the Administrative Assistant and the System Administrator. A small PDF, and one text file renamed to `fake.pdf`.

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
| B4 | Dean enters one amount above the location limit | Refused. At or below the limit: approved with e-signature |
| B5 | Dean as the student's adviser | Associate Dean approves in the Dean's place, no endorsement step |
| B6 | Chair as the adviser | Chair step skipped, Associate Dean next |
| B7 | Return with remarks, student resubmits | Earlier decisions kept, cycle goes up |
| B8 | Reject | Application closed, student told the reason |
| B9 | Student uploads the post-activity report PDF | Administrative Assistant notified |
| B10 | Administrative Assistant verifies, sets approved amount per item | Total shown, student notified |
| B11 | "Clarify with the Dean" | Dean receives the question and can reply |
| B12 | Download Reimbursement Report | One PDF, complete borders, signature, correct totals |
| B13 | File at FAO with an RFP number | Status "Filed at FAO" |

## C. Google link
| # | Step | Expected |
|---|---|---|
| C1 | After B2, within a minute | Row in the `Applications` tab; PDF in Drive under `Applications/<year-term>` |
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
`cd server && TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/postgres npm test` needs a PostgreSQL test database. It covers sign-in and roles, a whole application to filing, restart persistence, file access, the origin check, roles screen safeguards, signer overlaps and the public file list. It does not cover the Google link, the new privacy checks (D5, D8 to D10) or the layout.
