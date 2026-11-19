# SCGSS User Manual (v1.0)

SCGSS is the College of Computer Studies system for conference grant requests. You sign in through the CCS portal, so there is no separate password. Address: https://ccs.dlsu.edu.ph/scgss/

Your role decides what you see. If you get "Your account is not set up", ask the System Administrator to add you.

## Privacy in one minute
- The system keeps your name, DLSU email, student ID, degree program, year level, conference and expense details, the PDFs you upload, signatures, and a log of who opened or changed what.
- Only the people handling your application see it. Emails show your name, the reference, the event and the status, never amounts.
- Copies go to the College's Google Workspace (Sheets, Drive and email), which can store data outside the Philippines.
- You may ask to see, correct or withdraw your data, or complain to the National Privacy Commission. Contact the University Data Protection Officer.
- SCGSS never asks for your password by email. Treat such a message as phishing.

## Students

**Apply**
1. Choose **New application**. Pick the academic year and term, your degree program, and your Thesis Adviser.
2. Fill in the conference, paper and expense details. Pick the event location: the limit depends on it (NCR ₱6,000; Luzon ₱8,000; Ilocos, Cagayan or Bicol ₱10,000; Visayas or Mindanao ₱12,000; international ₱15,000).
3. Attach **one PDF** that holds all required documents, and tick the box that confirms it does.
4. Read the data privacy notice and tick the consent box. Without it you cannot submit.
5. Submit. You get a reference like `2627-Term1-001` and an email. Your form saves as a draft while you work.

**Follow it.** Open the application to see the stage, who it is waiting on, the history and the comments. The route is Thesis Adviser, Department Chair, Associate Dean, then Dean. If the same person holds two roles, the repeated step is skipped.

**If it is returned.** Read the remarks, reply or upload what is asked, and resubmit. Earlier decisions stay. If it is rejected, the application closes and you see the reason.

**After the event.** Within 15 days after the event ends, open **Post-activity report** and submit:
1. **Expenses to be reimbursed.** One line per expense (Add an expense): type, OR or invoice number, merchant and amount. The total cannot be more than your approved grant. Per diem is not reimbursed.
2. **One consolidated PDF**, in this order: proof of acceptance or invitation, official receipts or invoices, billing statements, itinerary receipts, peso conversion rate, Student ID. Tick each one you included. If one is missing, you can still submit: explain why in the box.
3. **Your Post-Conference Report** as a PDF.
4. **The article write-up:** the conference title and date (filled in for you, change them if needed), the location (taken from your application), and a summary of your work and key learnings of 300 to 500 words, with an acknowledgment. Add a high-resolution poster or social media graphic (PNG, JPG or PDF, up to 20 MB) following the CCS brand guidelines. The College may use the article for CCS News and Events.

You get reminders by email and in the app. The Administrative Assistant may return it with questions: upload only what needs correcting. A new upload is saved as a new version; an upload you leave empty keeps the earlier one.

**Reimbursement.** The Administrative Assistant verifies your three requirements and prepares the Summary of Expenses, and the Dean approves it. You are notified at each step and see the approved amount. When the Administrative Assistant submits your request to the FAO and records the Request for Payment (RFP) number, you get an email. Check the status at Window A or B, Finance Office, St. La Salle Hall, about 5 to 10 business days later, and bring the original receipts or invoices (or printed copies of electronic receipts).

## Thesis Advisers, Chairs, Associate Dean, Dean
1. You get an email and an in-app notice when it is your turn. Open the application, read the details and documents (open the PDF in the preview).
2. Choose **Endorse** (Adviser, Chair, Associate Dean), **Return with remarks**, or **Reject** with a reason.
3. **Dean:** to approve, enter **one grant amount and one funding source**, within the limit for the event location, then **Review and approve** and **Confirm approval**. No signature is needed at this step. The Administrative Assistant breaks the amount down later, per receipt.
4. **Dean, after the event:** when the Administrative Assistant sends the **Summary of Expenses**, you get an email and an in-app notice, and it shows under Pending on your dashboard. Open the application, read the full summary, add your **digital signature** (draw it, upload an image, or use your saved one), then **Review and approve** and **Confirm approval**. To change an amount or a funding source, use **Return to the Administrative Assistant** with remarks. The summary can be downloaded or printed only after you approve it.
5. If the Dean is the Thesis Adviser, the Associate Dean approves the grant, and later the Summary of Expenses, in the Dean's place. If the Chair is the adviser, the Chair step is skipped. If the Associate Dean is the adviser, the Dean is next.
6. You can only act when it is your turn. Use **Messages** to write to the student or another approver. Open only applications you handle: every file you open is logged.
7. The Dean's dashboard can be filtered by academic year and term.

## Administrative Assistant
1. After approval, wait for the student's post-activity report. You are notified.
2. Open **Verification**. Check the three requirements: the consolidated PDF (six documents), the Post-Conference Report, and the article with its graphic. Tick each one, or flag it to return to the student. Set the **approved amount and funding source per expense**. The total is checked against the Dean's grant.
3. Need the Dean's view on a funding source or an amount? Use **Clarify with the Dean**. The answer comes back to you.
4. Choose **Verify and send the summary to the Dean**. The validated Summary of Expenses goes to the Dean for approval and signature. If the Dean returns it, the remarks show on the Verification screen: correct it and send it again.
5. After the Dean approves, open **Summary of Expenses**: **Download** or **Print** the Student Conference Grant Summary of Expenses (with the Dean's signature), submit it to the FAO, then record the RFP number. The student is emailed.
6. Reports verified before 1.0.0-rc.6 have no Dean approval yet: open them on the Verification screen and send them to the Dean.
7. If you correct someone's data, say why in a comment. It is logged.

## System Administrator
- **Roles tab:** add, switch off or delete people; upload a CSV with a preview first. There must always be one active System Administrator, one Dean, one Associate Dean, and one Chair per department.
- **Access log:** lists sign-in refusals, role changes and file views. Review it monthly. Entries are deleted after the retention period.
- **Privacy requests:** follow `docs/DATA-PRIVACY.md`, section 7. `node users.js export <email>` gives the person's data.
- **Install, update, backup and recovery:** `docs/DEPLOY.md`. After every update run the checks in `docs/QA-TEST-PLAN.md`.

## Problems
| What you see | What to do |
|---|---|
| "Sign in to the CCS portal first" | Sign in to the portal, then reload |
| "Your account is not set up" | Ask the System Administrator to add you |
| "Not your turn" or a refused action | The application is with someone else, or already decided |
| The file is refused | Use a real PDF, PNG, JPG, DOCX, XLSX or TXT under 20 MB. A renamed file is refused |
| Old screen after an update | Press Ctrl+F5 |
| No email | Check spam; the notice in the app is the same message |
