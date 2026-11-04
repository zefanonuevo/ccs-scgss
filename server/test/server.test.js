'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const PGURL = process.env.TEST_DATABASE_URL;
if (!PGURL) { console.log('Set TEST_DATABASE_URL to a throwaway PostgreSQL database to run these tests.'); process.exit(0); }
const { open, makeStore } = require('../db');
const { createEngine } = require('../engine');
const { createGas } = require('../gas');
const { createApp } = require('../app');
const R = require('../../shared/rules');

/* the portal is stubbed: the cookie "as=<email>" means the portal says that person is signed in */
const me = async (cookie) => { const m = /as=([^;]+)/.exec(cookie || ''); return m ? { signedIn: true, email: decodeURIComponent(m[1]), name: '' } : { signedIn: false }; };
const ORIGIN = 'https://ccs.dlsu.edu.ph';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const SIG = 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E';

async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scgss-'));
  const schema = 't' + crypto.randomBytes(6).toString('hex');
  const admin = new Pool({ connectionString: PGURL }); await admin.query('CREATE SCHEMA ' + schema); await admin.end();
  const store = makeStore(open({ url: PGURL, schema })); await store.init();
  const gas = createGas({ url: '', token: '', filesDir: path.join(dir, 'files') });
  const engine = await createEngine({ store, gas });
  const app = createApp({ store, engine, gas, me, config: { baseUrl: ORIGIN, filesDir: path.join(dir, 'files'), allowedDomain: 'dlsu.edu.ph' } });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const as = (email) => ({
    get: (p) => fetch(base + p, { headers: email ? { cookie: 'as=' + email } : {} }),
    post: (p, body, extra) => fetch(base + p, { method: 'POST', headers: Object.assign({ cookie: email ? 'as=' + email : '', origin: ORIGIN, 'content-type': 'application/json' }, extra || {}), body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
    act: async (name, appId, ...args) => (await (await fetch(base + '/api/action', { method: 'POST', headers: { cookie: 'as=' + email, origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ name, appId, args }) })).json()),
    upload: async (name) => (await (await fetch(base + '/api/files', { method: 'POST', headers: { cookie: 'as=' + email, origin: ORIGIN, 'x-file-name': name, 'content-type': 'application/pdf' }, body: PDF })).json()).file
  });
  const people = [
    ['sys@dlsu.edu.ph', 'sysadmin', 'Sys Admin', ''], ['maria_santos@dlsu.edu.ph', 'student', 'Maria Santos', 'BSCS-ST'],
    ['paolo.reyes@dlsu.edu.ph', 'adviser', 'Dr. Reyes', ''], ['luis.mercado@dlsu.edu.ph', 'chair', 'Dr. Mercado', 'DST'],
    ['carla.mendoza@dlsu.edu.ph', 'assoc', 'Dr. Mendoza', ''], ['elena.navarro@dlsu.edu.ph', 'dean', 'Dr. Navarro', ''], ['rosa.delgado@dlsu.edu.ph', 'admin', 'Rosa Delgado', '']
  ];
  for (const [email, role, name, program] of people) await store.upsertUser({ email, role, name, program });
  return { store, engine, server, base, as, close: async () => { server.closeAllConnections(); server.close(); await store.close(); } };
}
const form = (file, adv) => ({ name: 'Santos, Maria L.', ay: '2627', term: 'Term1', sid: '12145678', prog: 'BSCS-ST', year: '4', adv, conf: 'ICSC 2026', start: '2026-10-05', end: '2026-10-09', venue: 'Kyoto', org: 'Society', etype: 'Conference', scope: 'intl', cls: 'Paper presenter', ptype: 'Full paper', index: 'Scopus', title: 'A Paper', cof: '', cos: '', exp: R.EXPENSE_TYPES.map((t, i) => ({ type: t, amount: [5500, 600, 4400, 3000, 1500][i], remarks: '' })), file, attConfirm: true, privacy: true, brand: true });
const MARIA = 'maria_santos@dlsu.edu.ph', REYES = 'paolo.reyes@dlsu.edu.ph';

test('sign-in comes from the portal, access from the SCGSS roles table', async (t) => {
  const s = await boot(); t.after(s.close);
  assert.equal((await s.as(null).get('/api/state')).status, 401);
  assert.equal((await s.as('stranger@dlsu.edu.ph').get('/api/state')).status, 403);
  await s.store.upsertUser({ email: 'off@dlsu.edu.ph', role: 'student', active: false });
  assert.equal((await s.as('off@dlsu.edu.ph').get('/api/state')).status, 403, 'a switched-off person is refused');
  const ok = await (await s.as(MARIA).get('/api/state')).json();
  assert.equal(ok.state.me.role, 'student');
  assert.equal((await s.as(null).get('/healthz')).status, 200);
});

test('full application, every role, to filing at the FAO', async (t) => {
  const s = await boot(); t.after(s.close);
  const maria = s.as(MARIA);
  const file = await maria.upload('requirements.pdf');
  const sub = await maria.act('submit', '', form(file, REYES));
  assert.equal(sub.ok, true, JSON.stringify(sub.result)); const id = sub.result.appId;
  const get = async (email) => (await (await s.as(email).get('/api/state')).json()).state.apps.find((a) => a.id === id);
  assert.equal((await get(MARIA)).ref, '2627-Term1-001');
  assert.equal(await get('sys@dlsu.edu.ph') !== undefined, true);
  assert.equal(await get('carla.mendoza@dlsu.edu.ph') !== undefined, true, 'route members see it');
  /* sequence is enforced */
  let r = await s.as('luis.mercado@dlsu.edu.ph').act('endorse', id, 'too early');
  assert.equal(r.ok, false);
  assert.equal((await s.as(MARIA).act('endorse', id, 'x')).ok, false, 'applicants cannot act on their own application');
  assert.equal((await s.as('rosa.delgado@dlsu.edu.ph').act('endorse', id, 'x')).ok, false);
  for (const e of [REYES, 'luis.mercado@dlsu.edu.ph', 'carla.mendoza@dlsu.edu.ph']) assert.equal((await s.as(e).act('endorse', id, 'ok')).ok, true, e);
  assert.equal((await s.as('elena.navarro@dlsu.edu.ph').act('approveGrant', id, { signature: SIG, confirm: true, amount: 16000, fund: 'x' })).ok, false, 'above the cap');
  assert.equal((await s.as('elena.navarro@dlsu.edu.ph').act('approveGrant', id, { signature: SIG, confirm: true, amount: 13500, fund: "Dean's Office" })).ok, true);
  assert.equal((await get(MARIA)).status, 'approved');
  const pf = await maria.upload('post.pdf'); const docs = {}; R.REQ_POST.forEach((x) => { docs[x[0]] = true; });
  const items = [{ type: 'Registration fee', or: 'OR-1', merchant: 'Secretariat', amount: 5500 }, { type: 'Roundtrip airfare', or: 'OR-2', merchant: 'Airline', amount: 4400 }];
  assert.equal((await maria.act('submitPost', id, { file: pf, items, docs, missingNote: '' })).ok, true);
  const adm = s.as('rosa.delgado@dlsu.edu.ph');
  assert.equal((await s.as(REYES).act('postReview', id, { items: [] }, 'verify')).ok, false, 'only the Administrative Assistant verifies');
  const rows = items.map((x) => ({ approved: x.amount, fund: "Dean's Office", why: '' }));
  assert.equal((await adm.act('postReview', id, { checks: docs, remarks: {}, items: rows, overall: 'ok' }, 'verify')).ok, true);
  assert.equal((await adm.act('complete', id, { rfp: 'RFP-1' })).ok, true);
  const done = await get(MARIA); assert.equal(done.status, 'completed'); assert.equal(done.report.rfp, 'RFP-1');
  /* a failed action leaves nothing behind */
  const n = done.history.length; await maria.act('comment', id, '', []); assert.equal((await get(MARIA)).history.length, n);
});

test('data survives a restart (state is written to PostgreSQL)', async (t) => {
  const s = await boot(); t.after(s.close);
  const file = await s.as(MARIA).upload('r.pdf');
  const sub = await s.as(MARIA).act('submit', '', form(file, REYES)); assert.equal(sub.ok, true);
  const again = await createEngine({ store: s.store, gas: createGas({ url: '', token: '', filesDir: os.tmpdir() }) });
  assert.equal(again.db.apps.length, 1); assert.equal(again.db.apps[0].ref, '2627-Term1-001');
  assert.equal(again.db.counters['2627-Term1'], 1);
});

test('files: only people on the application can open them; bad types refused', async (t) => {
  const s = await boot(); t.after(s.close);
  await s.store.upsertUser({ email: 'other_student@dlsu.edu.ph', role: 'student', program: 'BSIT' });
  const file = await s.as(MARIA).upload('r.pdf');
  const sub = await s.as(MARIA).act('submit', '', form(file, REYES)); assert.equal(sub.ok, true);
  assert.equal((await s.as(MARIA).get('/api/files/' + file.id)).status, 200);
  assert.equal((await s.as(REYES).get('/api/files/' + file.id)).status, 200);
  assert.equal((await s.as('other_student@dlsu.edu.ph').get('/api/files/' + file.id)).status, 404);
  assert.equal((await s.as(null).get('/api/files/' + file.id)).status, 401);
  const bad = await fetch(s.base + '/api/files', { method: 'POST', headers: { cookie: 'as=' + MARIA, origin: ORIGIN, 'x-file-name': 'run.exe' }, body: PDF });
  assert.equal(bad.status, 400);
  const fake = await fetch(s.base + '/api/files', { method: 'POST', headers: { cookie: 'as=' + MARIA, origin: ORIGIN, 'x-file-name': 'a.pdf' }, body: Buffer.from('not a pdf') });
  assert.equal(fake.status, 400);
});

test('requests that change data must come from the portal address', async (t) => {
  const s = await boot(); t.after(s.close);
  const r = await fetch(s.base + '/api/action', { method: 'POST', headers: { cookie: 'as=' + MARIA, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});

test('roles screen: System Administrator only, with safeguards', async (t) => {
  const s = await boot(); t.after(s.close);
  assert.equal((await s.as(MARIA).get('/api/users')).status, 403);
  assert.equal((await s.as(MARIA).post('/api/users', { email: 'x@dlsu.edu.ph', role: 'dean' })).status, 403);
  const sys = s.as('sys@dlsu.edu.ph');
  assert.equal((await sys.post('/api/users', { email: 'new@gmail.com', role: 'student' })).status, 400, 'outside the DLSU domain');
  assert.equal((await sys.post('/api/users', { email: 'two@dlsu.edu.ph', role: 'dean' })).status, 400, 'only one Dean');
  assert.equal((await sys.post('/api/users', { email: 'c@dlsu.edu.ph', role: 'chair' })).status, 400, 'chair needs a department');
  assert.equal((await sys.post('/api/users', { email: 'c2@dlsu.edu.ph', role: 'chair', program: 'DST' })).status, 400, 'one chair per department');
  assert.equal((await sys.post('/api/users', { email: 'c3@dlsu.edu.ph', role: 'chair', program: 'DIT', name: 'Dr. Tan' })).status, 200);
  assert.equal((await sys.post('/api/users', { email: 'sys@dlsu.edu.ph', role: 'student' })).status, 400, 'last System Administrator');
  assert.equal((await sys.post('/api/users', { email: 'sys@dlsu.edu.ph', role: 'sysadmin', active: false })).status, 400);
  assert.equal((await sys.post('/api/users', { email: MARIA, role: 'student', program: 'BSCS-ST', active: false })).status, 200);
  assert.equal((await s.as(MARIA).get('/api/state')).status, 403, 'switching someone off takes effect at once');
});

test('Dean as adviser: the Associate Dean approves in the Dean\'s place', async (t) => {
  const s = await boot(); t.after(s.close);
  const file = await s.as(MARIA).upload('r.pdf');
  const sub = await s.as(MARIA).act('submit', '', form(file, 'elena.navarro@dlsu.edu.ph')); assert.equal(sub.ok, true, JSON.stringify(sub.result)); const id = sub.result.appId;
  assert.equal((await s.as('elena.navarro@dlsu.edu.ph').act('endorse', id, 'ok')).ok, true);
  assert.equal((await s.as('luis.mercado@dlsu.edu.ph').act('endorse', id, 'ok')).ok, true);
  assert.equal((await s.as('elena.navarro@dlsu.edu.ph').act('approveGrant', id, { signature: SIG, confirm: true, amount: 5000, fund: 'x' })).ok, false, 'the Dean cannot approve their own advisee');
  assert.equal((await s.as('carla.mendoza@dlsu.edu.ph').act('approveGrant', id, { signature: SIG, confirm: true, amount: 5000, fund: "Dean's Office" })).ok, true);
});

test('routing refuses when a signer is missing', async (t) => {
  const s = await boot(); t.after(s.close);
  await s.store.setActive('carla.mendoza@dlsu.edu.ph', false);
  const file = await s.as(MARIA).upload('r.pdf');
  const sub = await s.as(MARIA).act('submit', '', form(file, REYES));
  assert.equal(sub.ok, false); assert.match(sub.result.err, /Associate Dean or Dean is not set/);
});

test('only the listed files are served', async (t) => {
  const s = await boot(); t.after(s.close);
  for (const p of ['/server/app.js', '/google/Code.gs', '/.git/config', '/js/../server/db.js', '/CHANGELOG.md']) assert.equal((await s.as(null).get(p)).status, 404, p);
  assert.equal((await s.as(null).get('/shared/rules.js')).status, 200);
});

test('students in the student email format are let in; other emails must be listed', async (t) => {
  const s = await boot(); t.after(s.close);
  const st = await s.as('juan_dela_cruz@dlsu.edu.ph').get('/api/state');
  assert.equal(st.status, 200, 'an unlisted student-format email is added as a student');
  assert.equal((await st.json()).state.me.role, 'student');
  assert.equal(s.store.getUser('juan_dela_cruz@dlsu.edu.ph').role, 'student');
  assert.equal((await s.as('maria.delacruz@dlsu.edu.ph').get('/api/state')).status, 403, 'a staff-format email that is not listed is refused');
  assert.equal((await s.as('juan_delacruz@gmail.com').get('/api/state')).status, 403, 'wrong domain is refused');
  await s.store.upsertUser({ email: 'pedro_penduko@dlsu.edu.ph', role: 'student', active: false });
  assert.equal((await s.as('pedro_penduko@dlsu.edu.ph').get('/api/state')).status, 403, 'a student who was switched off stays off');
});

test('each degree goes to the chair of its department', async (t) => {
  const s = await boot(); t.after(s.close);
  await s.store.upsertUser({ email: 'dct.chair@dlsu.edu.ph', role: 'chair', name: 'Chair DCT', program: 'DCT' });
  const maria = s.as(MARIA), file = await maria.upload('r.pdf');
  const dst = await maria.act('submit', '', form(file, REYES)); assert.equal(dst.ok, true);
  const view = (await (await maria.get('/api/state')).json()).state.apps[0];
  assert.equal(view.route.chair, 'luis.mercado@dlsu.edu.ph', 'BSCS-ST is DST');
  const f2 = await maria.upload('r2.pdf'), form2 = Object.assign(form(f2, REYES), { prog: 'BSCS-CSE', ay: '2627', term: 'Term2' });
  const dct = await maria.act('submit', '', form2); assert.equal(dct.ok, true, JSON.stringify(dct.result));
  const a2 = (await (await maria.get('/api/state')).json()).state.apps.find((x) => x.program === 'BSCS-CSE');
  assert.equal(a2.route.chair, 'dct.chair@dlsu.edu.ph', 'BSCS-CSE is DCT');
  const f3 = await maria.upload('r3.pdf'), none = await maria.act('submit', '', Object.assign(form(f3, REYES), { prog: 'BSIT' }));
  assert.equal(none.ok, false); assert.match(none.result.err, /No Department Chair is set for BSIT/);
});

test('the access list CSV: highest role wins, chairs carry a department', () => {
  const { parseAccessCsv } = require('../access-csv');
  const r = parseAccessCsv('Dean,a.b@dlsu.edu.ph\nThesis Adviser,c.d@dlsu.edu.ph\nDepartment Chair,c.d@dlsu.edu.ph,DST\nThesis Adviser,e.f@dlsu.edu.ph\nAssociate Dean,e.f@dlsu.edu.ph\n');
  const by = Object.fromEntries(r.rows.map((x) => [x.email, x]));
  assert.equal(r.problems.length, 0);
  assert.deepEqual([by['a.b@dlsu.edu.ph'].role, by['c.d@dlsu.edu.ph'].role, by['c.d@dlsu.edu.ph'].program, by['e.f@dlsu.edu.ph'].role], ['dean', 'chair', 'DST', 'assoc']);
  assert.equal(by['a.b@dlsu.edu.ph'].name, 'A B');
  assert.equal(parseAccessCsv('Janitor,x@dlsu.edu.ph').problems.length, 1);
});

test('the access list reads commas, tabs, spaces and stray quotes', () => {
  const { parseAccessCsv } = require('../access-csv');
  const r = parseAccessCsv('Dean,a.b@dlsu.edu.ph\n"Thesis Adviser    c.d@dlsu.edu.ph    "\nThesis Adviser\te.f@dlsu.edu.ph\nDepartment Chair   g.h@dlsu.edu.ph   DIT\n');
  assert.equal(r.problems.length, 0, r.problems.join());
  assert.deepEqual(r.rows.map((x) => x.role + ':' + x.email + ':' + x.program), ['dean:a.b@dlsu.edu.ph:', 'adviser:c.d@dlsu.edu.ph:', 'adviser:e.f@dlsu.edu.ph:', 'chair:g.h@dlsu.edu.ph:DIT']);
});

test('script addresses carry a version so a cached old file is never used', async (t) => {
  const s = await boot(); t.after(s.close);
  const html = await (await s.as(null).get('/')).text();
  const tags = html.match(/<script src="[^"]+"/g) || [];
  assert.ok(tags.length >= 7);
  tags.forEach((x) => assert.match(x, /\.js\?v=[a-z0-9]+"$/, x));
  const js = await s.as(null).get('/js/core.js?v=abc'); assert.equal(js.status, 200);
});

test('the student types their own name as Last Name, First Name MI', async (t) => {
  const s = await boot(); t.after(s.close);
  const maria = s.as(MARIA), file = await maria.upload('n.pdf');
  for (const bad of ['', 'Maria', 'Maria Santos', 'Santos,', ', Maria', 'Santos, M4ria', 'S, M']) {
    const r = await maria.act('submit', '', Object.assign(form(file, REYES), { name: bad }));
    assert.equal(r.ok, false, JSON.stringify(bad)); assert.match(r.result.err, /Last Name, First Name MI/);
  }
  const ok = await maria.act('submit', '', Object.assign(form(file, REYES), { name: '  dela   Cruz,   Maria  L. ' }));
  assert.equal(ok.ok, true, JSON.stringify(ok.result));
  const a = (await (await maria.get('/api/state')).json()).state.apps[0];
  assert.equal(a.studentName, 'dela Cruz, Maria L.', 'spaces tidied, otherwise as typed');
  assert.equal(a.history[0].by, 'dela Cruz, Maria L.');
});

test('bulk delete, switch off and CSV import with a preview first', async (t) => {
  const s = await boot(); t.after(s.close);
  const sys = s.as('sys@dlsu.edu.ph');
  const bulk = async (b) => { const r = await sys.post('/api/users/bulk', b); return { status: r.status, body: await r.json() }; };
  assert.equal((await s.as(MARIA).post('/api/users/bulk', { kind: 'emails', action: 'delete', emails: [REYES] })).status, 403, 'System Administrator only');
  /* a preview changes nothing */
  let r = await bulk({ kind: 'emails', action: 'delete', emails: [REYES, MARIA] });
  assert.equal(r.body.plan.ok, true); assert.equal(r.body.applied, false); assert.ok(s.store.getUser(REYES));
  /* the safeguards: yourself, the last System Administrator, the only Dean */
  assert.equal((await bulk({ kind: 'emails', action: 'delete', emails: ['sys@dlsu.edu.ph'] })).body.plan.ok, false);
  assert.equal((await bulk({ kind: 'emails', action: 'off', emails: ['elena.navarro@dlsu.edu.ph'], apply: true })).status, 200, 'switching the Dean off is allowed (a new Dean can be added)');
  assert.equal((await bulk({ kind: 'emails', action: 'on', emails: ['elena.navarro@dlsu.edu.ph'], apply: true })).status, 200);
  /* delete for real: access ends at once, and the saved draft goes with the person */
  await s.store.putDraft(REYES, { a: 1 });
  r = await bulk({ kind: 'emails', action: 'delete', emails: [REYES], apply: true });
  assert.equal(r.status, 200); assert.equal(r.body.applied, true); assert.equal(s.store.getUser(REYES), null);
  assert.equal(await s.store.getDraft(REYES), null);
  assert.equal((await s.as(REYES).get('/api/state')).status, 403);
  /* CSV, add and update: a second Dean in the file is refused, a new adviser is added, the Associate Dean's role is changed */
  const csv1 = 'Thesis Adviser,new.adviser@dlsu.edu.ph\nDean,second.dean@dlsu.edu.ph\n';
  r = await bulk({ kind: 'csv', mode: 'merge', csv: csv1, apply: true });
  assert.equal(r.status, 400, 'two Deans');
  const csv2 = 'Thesis Adviser,new.adviser@dlsu.edu.ph\nDepartment Chair,new.chair@dlsu.edu.ph,DIT\nAdministrative Assistant,rosa.delgado@dlsu.edu.ph\n';
  r = await bulk({ kind: 'csv', mode: 'merge', csv: csv2 });
  assert.deepEqual([r.body.plan.counts.add, r.body.plan.counts.same], [2, 1]);
  r = await bulk({ kind: 'csv', mode: 'merge', csv: csv2, apply: true });
  assert.equal(r.status, 200); assert.equal(s.store.getUser('new.chair@dlsu.edu.ph').program, 'DIT');
  /* replace the staff list: staff not in the file are deleted, students and System Administrators never are */
  r = await bulk({ kind: 'csv', mode: 'sync', csv: 'Dean,elena.navarro@dlsu.edu.ph\nAssociate Dean,carla.mendoza@dlsu.edu.ph\nDepartment Chair,luis.mercado@dlsu.edu.ph,DST\nAdministrative Assistant,rosa.delgado@dlsu.edu.ph\n', apply: true });
  assert.equal(r.status, 200); assert.equal(s.store.getUser('new.adviser@dlsu.edu.ph'), null); assert.equal(s.store.getUser('new.chair@dlsu.edu.ph'), null);
  assert.ok(s.store.getUser(MARIA)); assert.ok(s.store.getUser('sys@dlsu.edu.ph'));
  /* delete by a list of emails, in any layout */
  r = await bulk({ kind: 'csv', mode: 'remove', csv: 'email\n"' + MARIA + '"; nobody@dlsu.edu.ph\n', apply: true });
  assert.equal(r.status, 200); assert.equal(s.store.getUser(MARIA), null); assert.deepEqual(r.body.plan.notFound, ['nobody@dlsu.edu.ph']);
  assert.equal((await bulk({ kind: 'csv', mode: 'remove', csv: 'sys@dlsu.edu.ph', apply: true })).status, 400, 'cannot delete yourself');
});
