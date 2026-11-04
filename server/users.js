'use strict';
/* Manage who may use SCGSS and in which role.  node users.js list | add <email> <role> [name] [program] | import <file.csv> | disable <email> | enable <email> | delete <email> | audit [n]
   Roles: student, adviser, chair (needs a department: DCT, DST or DIT), assoc (Associate Dean), dean, admin (Administrative Assistant), sysadmin. */
const path = require('node:path');
const fs = require('node:fs');
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env */ }
const { open, makeStore } = require('./db');
const [cmd, ...a] = process.argv.slice(2);
(async () => {
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
const store = makeStore(open({ url: process.env.DATABASE_URL }));
await store.init();
try {
  if (cmd === 'list') {
    store.listUsers().forEach((u) => console.log([u.active ? 'on ' : 'OFF', u.role.padEnd(8), (u.program || '').padEnd(5), u.email, u.name].join('  ')));
  } else if (cmd === 'add') {
    if (a.length < 2) throw new Error('Usage: add <email> <role> [name] [program]');
    const u = await store.upsertUser({ email: a[0], role: a[1], name: a[2] || '', program: a[3] || '' });
    await store.audit('cli', 'user_set', u.email + ' role=' + u.role); console.log('Saved:', u.email, u.role, u.program || '');
  } else if (cmd === 'disable' || cmd === 'enable') {
    if (!a[0]) throw new Error('Usage: ' + cmd + ' <email>');
    console.log(await store.setActive(a[0], cmd === 'enable') ? 'Done.' : 'No such user.'); await store.audit('cli', cmd, a[0]);
  } else if (cmd === 'import') {
    if (!a[0]) throw new Error('Usage: import <file.csv>   (lines: Role,email[,department])');
    const { rows, problems } = require('./access-csv').parseAccessCsv(fs.readFileSync(a[0], 'utf8'));
    if (problems.length) throw new Error(problems.join('\n'));
    for (const r of rows) { const was = store.getUser(r.email); await store.upsertUser({ email: r.email, role: r.role, name: (was && was.name) || r.name, program: r.program, active: true }); }
    await store.audit('cli', 'import', a[0] + ': ' + rows.length + ' people');
    const n = {}; rows.forEach((r) => { n[r.role] = (n[r.role] || 0) + 1; }); console.log('Imported', rows.length, 'people:', JSON.stringify(n));
  } else if (cmd === 'delete') {
    if (!a[0]) throw new Error('Usage: delete <email>');
    const plan = require('./people').planFromEmails(store, { action: 'delete', emails: [a[0]], self: '' });
    if (!plan.ok) throw new Error(plan.problems[0] || 'Nothing to delete.');
    await store.bulkApply({ deletes: plan.deletes }); await store.audit('cli', 'user_bulk', 'delete: ' + a[0]); console.log('Deleted', a[0]);
  } else if (cmd === 'audit') {
    (await store.lastAudit(Number(a[0]) || 30)).forEach((r) => console.log(new Date(r.ts).toISOString(), r.email || '-', r.event, r.detail));
  } else { console.log('Commands: list | add <email> <role> [name] [program] | import <file.csv> | disable <email> | enable <email> | delete <email> | audit [n]'); }
} finally { await store.close(); }
})().catch((e) => { console.error('Error:', e.message); process.exitCode = 1; });
