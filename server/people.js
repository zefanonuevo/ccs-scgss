'use strict';
/* Bulk changes to the people list: plan first (what would change, and whether the result is allowed), apply second.
   Nothing here writes to the database; app.js applies a plan with store.bulkApply(). */
const { parseAccessCsv } = require('./access-csv');
const R = require('../shared/rules');
const DEPARTMENTS = R.DEPARTMENTS.map((d) => d[0]);
const STAFF = ['adviser', 'chair', 'assoc', 'dean', 'admin'];   /* "replace the list" only ever removes these roles */
const ROLE_NAME = { student: 'Student', adviser: 'Thesis Adviser', chair: 'Department Chair', assoc: 'Associate Dean', dean: 'Dean', admin: 'Administrative Assistant', sysadmin: 'System Administrator' };

/** Is the resulting list allowed? Same rules as the single-person form: one Dean, one Associate Dean, one chair per department, at least one System Administrator. */
function checkFinal(list) {
  const out = [], on = list.filter((u) => u.active);
  if (!on.some((u) => u.role === 'sysadmin')) out.push('There must be at least one active System Administrator.');
  const dup = (what, arr) => { if (arr.length > 1) out.push('Only one active ' + what + ' is allowed, but this would leave ' + arr.length + ': ' + arr.map((u) => u.name || u.email).join(', ') + '.'); };
  dup('Dean', on.filter((u) => u.role === 'dean'));
  dup('Associate Dean', on.filter((u) => u.role === 'assoc'));
  DEPARTMENTS.forEach((d) => dup('Department Chair for ' + d, on.filter((u) => u.role === 'chair' && u.program === d)));
  return out;
}

const emailsIn = (text) => [...new Set((String(text).toLowerCase().match(/[^\s,;"'<>()]+@[^\s,;"'<>()]+\.[^\s,;"'<>()]+/g) || []).map((e) => e.replace(/[.]+$/, '')))];

/** mode: merge (add and update), sync (merge, and remove staff who are not in the file) or remove (delete everyone whose email is in the file). */
function planFromCsv(store, { mode, csv, self, domain }) {
  const plan = { mode, add: [], change: [], same: [], remove: [], notFound: [], problems: [], upserts: [], deletes: [] };
  if (mode === 'remove') {
    emailsIn(csv).forEach((e) => { const u = store.getUser(e); if (u) plan.remove.push(u); else plan.notFound.push(e); });
    if (!plan.remove.length && !plan.notFound.length) plan.problems.push('No email addresses were found in the file.');
  } else {
    const { rows, problems } = parseAccessCsv(csv);
    plan.problems.push(...problems);
    if (!rows.length && !problems.length) plan.problems.push('The file is empty.');
    rows.forEach((r) => {
      if (domain && !r.email.endsWith('@' + domain)) { plan.problems.push(r.email + ' is not an @' + domain + ' address.'); return; }
      if (r.role === 'chair' && !DEPARTMENTS.includes(r.program)) { plan.problems.push(r.email + ': a Department Chair needs a department (' + DEPARTMENTS.join(', ') + ') in the third column.'); return; }
      const was = store.getUser(r.email), next = { email: r.email, role: r.role, name: (was && was.name) || r.name, program: r.role === 'chair' ? r.program : '', active: 1 };
      if (!was) { plan.add.push(next); plan.upserts.push(next); }
      else if (was.role === next.role && was.program === next.program && was.active) plan.same.push(next);
      else { plan.change.push({ ...next, was: was.role + (was.active ? '' : ' (switched off)') }); plan.upserts.push(next); }
    });
    if (mode === 'sync') {
      const inFile = new Set(rows.map((r) => r.email));
      store.listUsers().forEach((u) => { if (STAFF.includes(u.role) && !inFile.has(u.email)) plan.remove.push(u); });
    }
  }
  if (plan.remove.some((u) => u.email === self)) plan.problems.push('You cannot delete your own account.');
  plan.deletes = plan.remove.map((u) => u.email);
  finish(store, plan);
  return plan;
}

/** The same plan for ticked rows: action is delete, off or on. */
function planFromEmails(store, { action, emails, self }) {
  const plan = { mode: action, add: [], change: [], same: [], remove: [], notFound: [], problems: [], upserts: [], deletes: [] };
  [...new Set((emails || []).map((e) => String(e).trim().toLowerCase()))].forEach((e) => {
    const u = store.getUser(e);
    if (!u) { plan.notFound.push(e); return; }
    if (action === 'delete') plan.remove.push(u);
    else plan.upserts.push({ ...u, active: action === 'on' ? 1 : 0 });
  });
  if (action !== 'on' && (emails || []).some((e) => String(e).toLowerCase() === self)) plan.problems.push('You cannot ' + (action === 'delete' ? 'delete' : 'switch off') + ' your own account.');
  if (!plan.remove.length && !plan.upserts.length) plan.problems.push('Nobody was selected.');
  plan.deletes = plan.remove.map((u) => u.email);
  finish(store, plan);
  return plan;
}

function finish(store, plan) {
  const m = new Map(store.listUsers().map((u) => [u.email, { ...u }]));
  plan.upserts.forEach((u) => m.set(u.email, { ...u }));
  plan.deletes.forEach((e) => m.delete(e));
  const touched = plan.upserts.length || plan.deletes.length;
  if (touched) plan.problems.push(...checkFinal([...m.values()]));
  plan.ok = plan.problems.length === 0 && touched > 0;
}

/** What the screen needs: counts and short lists (never more than 200 names). */
const brief = (u) => ({ email: u.email, name: u.name || '', role: u.role, roleName: ROLE_NAME[u.role], program: u.program || '', was: u.was || '' });
function summary(plan) {
  return {
    ok: plan.ok, mode: plan.mode, problems: plan.problems.slice(0, 60),
    counts: { add: plan.add.length, change: plan.change.length, same: plan.same.length, remove: plan.remove.length, notFound: plan.notFound.length, off: plan.mode === 'off' ? plan.upserts.length : 0, on: plan.mode === 'on' ? plan.upserts.length : 0 },
    add: plan.add.slice(0, 200).map(brief), change: plan.change.slice(0, 200).map(brief), remove: plan.remove.slice(0, 200).map(brief), notFound: plan.notFound.slice(0, 200),
  };
}

module.exports = { planFromCsv, planFromEmails, summary, checkFinal, emailsIn, STAFF };
