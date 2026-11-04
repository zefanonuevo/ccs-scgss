# SCGSS Data Privacy Paper

**System:** CCS Student Conference Grant Support System (SCGSS), version 1.0.0-rc.1 (build 4.2.0)
**Controller:** De La Salle University, College of Computer Studies (CCS)
**Prepared:** 5 November 2026, from a review of the system's code and setup
**Status:** Draft for the University Data Protection Officer (DPO) to review and approve. It is a working assessment, not legal advice. Items marked **[confirm]** are my reading of a rule or a fact about the University that someone with authority must check before go-live.

## 1. Purpose and scope

This paper does three things for SCGSS: it lists the personal data the system holds and where it goes; it checks that against the Philippine Data Privacy Act of 2012 (RA 10173) and against widely used international standards; and it records what has been done and what is still needed. It covers the web application, its database and file store on the CCS apps VM, the Google Apps Script link (Sheet, Drive and email), the portal sign-in, the Cloudflare layer and the backups. It does not cover the University's other systems.

## 2. What the system holds

| Data | Whose | Why it is needed | Where it sits | Who can see it |
|---|---|---|---|---|
| Name, DLSU email, role | Students, staff | Sign-in match, routing, history | PostgreSQL `scgss_users`, `apps` | Handling approvers, System Administrator |
| Student ID, degree program, year level | Applicant | Evaluate the grant, route to the right Chair | `apps`, Google Sheet | Handling approvers, Administrative Assistant |
| Conference, paper and expense details | Applicant | Evaluate and reimburse | `apps`, Google Sheet | Same |
| Uploaded PDFs, receipts | Applicant | Evidence for approval and reimbursement | Disk `/srv/apps/scgss/data`, copy in Google Drive | Same |
| Digital signature image | Approvers, optionally students | Sign grant approvals and reports | PostgreSQL `sigs`, embedded in PDF reports | Owner, report readers |
| Comments, decisions, history | Everyone involved | Record of who decided what | `apps` | Participants on that application |
| Access log: email, action, network address | Everyone | Security and accountability | PostgreSQL `audit` | System Administrator |
| Notification emails | Everyone | Tell people action is needed | Gmail account computerstudies@dlsu.edu.ph, `outbox` | Mailbox owners, recipients |

**Sensitive information.** The Act lists *education* among sensitive personal information (Section 3(l)). A student's degree program and year, linked to a funding request, is close enough that I recommend treating the whole record as sensitive. That requires specific, informed consent (Section 13), which the application form collects and records. **[confirm with the DPO]**

**Data flow.** Browser, to Cloudflare, to Apache on the portal VM, to the SCGSS service on the apps VM. The service asks the portal who is signed in, stores records in PostgreSQL and files on disk, and passes a copy of rows, files and emails to Google Apps Script, which writes to Sheets and Drive and sends email through Gmail.

**Parties that handle the data on the University's behalf:** Google (Workspace, Apps Script, Gmail, Drive) and Cloudflare. Cloudflare ends the HTTPS connection, so it can see traffic in clear, including uploads and signatures. Both may process data outside the Philippines.

## 3. Philippine requirements and how SCGSS stands

| Requirement | Source | State in SCGSS |
|---|---|---|
| Transparency, legitimate purpose, proportionality | RA 10173 s.11 | Notice rewritten in this release to list data, purpose, recipients, storage and transfer, retention and rights. Data limited to what the grant needs. Emails show name, reference, event, dates and status only, no amounts. |
| Lawful basis, consent for sensitive data | s.12, s.13 | Consent tick box before submission. The consent time **and notice version** are now stored on each application. |
| Rights of the data subject | s.16, IRR | Access: `node users.js export <email>` produces everything held on one person. Correction: through Return and resubmit, or the Administrative Assistant. Withdrawal and erasure: handled by request (section 7), subject to retention duties. |
| Security measures: organizational, physical, technical | s.20, NPC Circular 2023-06 **[confirm]** | See section 5. |
| Accountability, DPO, outsourcing | s.21, IRR s.43 to 45 | Google and Cloudflare must be covered by written terms that bind them to the University's instructions and to security duties. **Not verified.** |
| Breach notification | s.20(f), NPC Circular 16-03 | NPC and affected people within 72 hours of knowing of a breach that involves sensitive data or risks serious harm. Procedure in section 8. |
| Registration and records of processing | IRR s.46 to 47, NPC Circular 2022-04 **[confirm]** | The University should confirm SCGSS is listed under its registered processing systems. |
| Data sharing | NPC Circular 2020-03 **[confirm]** | Sharing with the University's accounting office is internal. Anything sent to another organization needs a written agreement. |
| Retention only as long as necessary | s.11(e) | Access logs: 12 months, deleted automatically. Application and reimbursement records: no period is set in the system yet. See section 6. |

## 4. International benchmark

The Act is the binding law. The standards below are used as a yardstick. GDPR applies by law only if the University handles data of people in the EU, which I do not expect here.

| Area | Reference | What SCGSS does | Gap |
|---|---|---|---|
| Principles | GDPR Art. 5; ISO/IEC 29100 | Purpose limit, minimal data, notice, accuracy through Return and resubmit | Retention not yet fixed |
| Lawful basis, valid consent | GDPR Art. 6, 7 | Explicit tick box, withdrawable, recorded with version | Consent is bundled with the grant request; the DPO should confirm that is acceptable |
| Transparency | GDPR Art. 12 to 14 | Plain notice on the form | Needs the DPO's name and contact filled in |
| Data subject rights | GDPR Art. 15 to 22 | Export tool, correction route | Erasure and objection are manual |
| Privacy by design | GDPR Art. 25; ISO/IEC 27701 | Role-based access, per-application view checks, minimal email | Signature images and files are not encrypted at the application level |
| Processors and transfers | GDPR Art. 28, 44 to 49; APEC CBPR | Google, Cloudflare | Written terms and transfer basis not verified |
| Records of processing | GDPR Art. 30 | This paper, section 2 | Needs formal adoption |
| Security | GDPR Art. 32; ISO/IEC 27001:2022 Annex A 5.15, 8.3, 8.15, 8.24 | Portal sign-in, role checks, origin check, upload type checks, access logging, encrypted backups, security headers | Disk encryption, MFA at the portal and a log review routine are not verified |
| Logging and review | ISO/IEC 27001 A.8.15 | Sign-in refusals, role changes, file views and downloads logged | No scheduled review |
| Supplier and cloud use | ISO/IEC 27001 A.5.19 to 5.23 | Google, Cloudflare | Supplier review not on record |
| Incidents | GDPR Art. 33, 34; ISO/IEC 27001 A.5.24 to 5.28 | Procedure in section 8 | Needs a drill |
| Impact assessment | GDPR Art. 35; ISO/IEC 29134 | Section 9 of this paper | Needs DPO sign-off |
| Web application security | OWASP ASVS 4.0.3 | Parameterized queries, same-origin checks, no inline file execution, upload magic-byte checks | No external penetration test |
| Deletion | ISO/IEC 27001 A.8.10 | Log purge; delete of user removes draft and signature | Application records have no deletion schedule |

## 5. Controls in place in this release

Technical: sign-in only through the CCS portal; every action checked against the person's role and turn; requests that change data accepted only from the portal's address; file access only for people allowed to view that application; uploads limited to six types, 20 MB, and the first bytes must match the type; stored files never run; security headers including a ban on camera, microphone and location; every file view and download logged with who, which application and network address; access logs deleted after `AUDIT_KEEP_DAYS` (365 by default); nightly encrypted backups with the key kept off the server; emails carry a confidentiality line.

Organizational: one System Administrator controls roles; the last administrator cannot be removed; the Dean, Associate Dean and each Chair are single-holder roles; every role change is logged.

## 6. Retention

The system deletes only access logs by itself. For applications, reimbursement documents, signatures and the Sheet and Drive copies, the Records Officer and the Finance office must set the period. Tax and accounting rules may require supporting documents to be kept for several years, so I have not set a figure. **[confirm]** Proposed rule: keep records for the period they set, then delete the application, its files, the Drive copies and the Sheet row together, and keep only anonymous totals. The system has no automatic deletion for these yet.

## 7. Handling requests from people

1. Verify the person through their DLSU account or through the University's usual identity check.
2. **Access or copy:** the System Administrator runs `node users.js export <email>` on the apps VM and sends the result by a secure channel. The Sheet and Drive copies hold the same data.
3. **Correction:** return the application so the student corrects it, or the Administrative Assistant corrects it and logs the reason.
4. **Withdraw consent or erase:** tell the person that a withdrawal can stop the application, and that records the University must keep cannot be erased until the retention period ends. If erasure is allowed, delete the record in PostgreSQL, the file on disk, the Drive copy and the Sheet row, and note the request in the log.
5. Answer in writing within 15 days as an internal target. The Act has no fixed day count here. **[confirm]**

## 8. Personal data breach procedure

1. Anyone who suspects a breach tells the System Administrator and the DPO at once.
2. Contain: switch off the affected account in the Roles tab, rotate `GAS_TOKEN` and the database password if exposed, take a copy of the logs.
3. Assess with the DPO within 24 hours: what data, how many people, whether sensitive data is involved, the risk of serious harm.
4. Notify the National Privacy Commission and the affected students within 72 hours of knowing, when the rules require it. Record every breach, including those not notified.
5. Review the cause and fix it. Record it in the CHANGELOG as a security fix without personal detail.

## 9. Risk assessment (summary)

| # | Risk | Likelihood | Impact | Control now | Still needed |
|---|---|---|---|---|---|
| 1 | Someone outside a case sees an application | Low | High | Role and turn checks, file access check, logged views | Quarterly access review |
| 2 | A shared account (computerstudies@) is taken over | Medium | High | None in the app | MFA, limited owners, review of Drive sharing |
| 3 | Cloudflare or Google handle data without proper terms | Medium | High | None | Written terms, transfer basis, DPO sign-off |
| 4 | The page loads its stylesheet from a personal GitHub Pages site, so every visitor's address reaches a third party | Medium | Low | Referrer limited to origin | Host the stylesheet on the CCS server |
| 5 | A failed Google sync is never retried, so records diverge | High | Low | Error logged | Retry and reconcile job |
| 6 | Signatures and uploads readable from a stolen disk or backup | Low | High | Backups encrypted | Disk encryption on the apps VM |
| 7 | Records kept too long | High | Medium | Log purge only | Retention schedule and deletion job |
| 8 | A phishing email copies the SCGSS format | Medium | Medium | Fixed sender name and footer | Tell students that SCGSS never asks for passwords |
| 9 | Under-18 student | Low | Medium | None | Check for age and parental consent if applicable |

Overall residual risk is **medium**, driven by items 2, 3 and 7, which need decisions from the University, not code.

## 10. Actions before go-live

| Owner | Action |
|---|---|
| DPO | Approve or edit the notice (`shared/rules.js`, `PRIVACY`), add the DPO name and contact, and raise `PRIVACY_VERSION` when it changes |
| DPO, Records Officer, Finance | Set the retention period and the deletion step |
| DPO, ICT | Confirm written terms with Google and Cloudflare, and the transfer basis |
| DPO | Confirm registration of SCGSS and sign this paper |
| ICT | Turn on MFA for the portal and for the computerstudies@ account; encrypt the apps VM disk; host the stylesheet locally |
| System Administrator | Review roles each term; review the access log monthly; do one restore test |
| CCS | Tell students and staff who to contact for privacy requests |

## 11. References

- Republic Act 10173, Data Privacy Act of 2012, and its Implementing Rules and Regulations
- National Privacy Commission: Circular 16-03 (personal data breach management); Circular 2023-06 (security of personal data); Circular 2022-04 (registration); Circular 2020-03 (data sharing); Advisory on Data Protection Officers. **[confirm current numbers and text]**
- Regulation (EU) 2016/679 (GDPR)
- ISO/IEC 27001:2022 and 27002:2022; ISO/IEC 27701; ISO/IEC 29100; ISO/IEC 29134
- OWASP Application Security Verification Standard 4.0.3
- NIST Privacy Framework 1.0; OECD Privacy Guidelines (2013); APEC Privacy Framework and Cross-Border Privacy Rules

## 12. What I did not check

I read the code and the setup guide. I did not read the University's agreements with Google or Cloudflare, its records retention schedule, its NPC registration, or the portal's own security. Circular numbers and section references come from my knowledge, not from a live check of the NPC site, so the DPO should verify them. The controls above were checked by reading and syntax checks; the server tests were not run for this change because they need a PostgreSQL test database.
