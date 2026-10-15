/**
 * CCS SCGSS: Google Apps Script back end for the Sheet, Drive and email.
 *
 * What it does, when the web page posts to it:
 *   action "upsert": writes or updates ONE row per application in the "Applications" sheet (matched on Reference).
 *   action "file":   saves an uploaded file in the designated Drive folder, in a sub-folder (for example Applications/2627-Term1).
 *   action "email":  sends a notification email.
 *
 * Setup (about 10 minutes):
 *   1. Create a Google Sheet. Open Extensions > Apps Script and paste this file.
 *   2. In Drive, create the designated folder (for example "CCS-SCGSS"). Copy its ID from the URL.
 *   3. Project Settings > Script properties, add:
 *        TOKEN           a long random string (also paste it in the app's Settings)
 *        FOLDER_ID       the Drive folder ID
 *        ALLOWED_DOMAIN  optional, for example dlsu.edu.ph. Emails go only to this domain.
 *   4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *      Copy the web app URL and paste it, with the token, in the app under Settings.
 *   5. Run authorize() once from the editor so Google asks for Sheet, Drive and Mail permission.
 *
 * Security note: the token is a shared secret, not a user sign-in. It keeps strangers out, but anyone who holds the
 * token can write. A production build should check the signed-in Google user on every request.
 */
var SHEET_NAME = 'Applications';

function doPost(e) {
  var p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  var props = PropertiesService.getScriptProperties();
  if (!p.token || p.token !== props.getProperty('TOKEN')) return out_({ ok: false, error: 'bad token' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (p.action === 'upsert') upsert_(p.key, p.row);
    else if (p.action === 'file') saveFile_(p.folder, p.name, p.mime, p.b64);
    else if (p.action === 'email') sendEmail_(p.to, p.subject, p.body);
    else return out_({ ok: false, error: 'unknown action' });
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function upsert_(key, row) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  var headers = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  Object.keys(row).forEach(function (k) {
    if (headers.indexOf(k) < 0) { headers.push(k); sh.getRange(1, headers.length).setValue(k); }
  });
  var values = headers.map(function (h) { return row[h] === undefined ? '' : row[h]; });
  var refCol = headers.indexOf('Reference') + 1;
  var at = 0;
  if (sh.getLastRow() > 1 && refCol > 0) {
    var hit = sh.getRange(2, refCol, sh.getLastRow() - 1, 1).createTextFinder(String(key)).matchEntireCell(true).findNext();
    if (hit) at = hit.getRow();
  }
  if (!at) at = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(at, 1, 1, values.length).setValues([values]);
  sh.setFrozenRows(1);
}

function folderFor_(path) {
  var folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  String(path || '').split('/').filter(String).forEach(function (name) {
    var it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  });
  return folder;
}

function saveFile_(path, name, mime, b64) {
  var folder = folderFor_(path);
  var old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true); // same name means a replacement; the older copy goes to the Drive trash
  folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime || 'application/pdf', name));
}

function sendEmail_(to, subject, body) {
  var domain = PropertiesService.getScriptProperties().getProperty('ALLOWED_DOMAIN');
  if (domain && String(to).toLowerCase().slice(-(domain.length + 1)) !== '@' + domain.toLowerCase()) return;
  MailApp.sendEmail(to, subject, body);
}

/** Run once from the editor to grant permissions. */
function authorize() {
  SpreadsheetApp.getActive();
  DriveApp.getRootFolder();
  MailApp.getRemainingDailyQuota();
}
