'use strict';
/* Reads the access list CSV: "Role,email[,department]" per line (no header). One role per person: if a person is listed more than once,
   the highest role wins (Dean, Associate Dean, Department Chair, Administrative Assistant, Thesis Adviser). Chairs need a department
   (DCT, DST or DIT) in the third column. A Chair can still be chosen as a Thesis Adviser. Names are made from the email and can be edited later. */
const MAP = { 'dean': 'dean', 'associate dean': 'assoc', 'department chair': 'chair', 'administrative assistant': 'admin', 'thesis adviser': 'adviser', 'system administrator': 'sysadmin' };
const RANK = ['sysadmin', 'dean', 'assoc', 'chair', 'admin', 'adviser'];
const niceName = (email) => email.split('@')[0].split('.').map((w) => w.split('-').map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join('-')).join(' ');

function parseAccessCsv(text) {
  const best = new Map(), problems = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    /* the columns may be separated by commas, tabs or two or more spaces (pasted from a sheet); quote marks are ignored */
    const [label, email, dept] = line.replace(/["\u201c\u201d\ufeff]/g, '').trim().split(/\s*[,\t]\s*|\s{2,}/).map((s) => s.trim());
    const role = MAP[String(label || '').toLowerCase()], mail = String(email || '').toLowerCase();
    if (!role || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { problems.push('Line ' + (i + 1) + ': cannot read "' + line + '"'); return; }
    const cur = best.get(mail);
    if (!cur || RANK.indexOf(role) < RANK.indexOf(cur.role)) best.set(mail, { email: mail, role, name: niceName(mail), program: role === 'chair' ? String(dept || '').toUpperCase() : '' });
  });
  return { rows: [...best.values()], problems };
}
module.exports = { parseAccessCsv, niceName };
