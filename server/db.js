'use strict';
/* PostgreSQL storage for SCGSS: roles (scgss_users), applications, files, notices, audit log.
   The engine keeps the working state in memory and calls commit() after every action; commit() writes only the rows that changed,
   in one transaction. The people list is also kept in memory (it is small) so role checks are instant; every change goes to the database first. */
const { Pool } = require('pg');

const ROLES = ['student', 'adviser', 'chair', 'assoc', 'dean', 'admin', 'sysadmin'];
const R = require('../shared/rules');
const PROGRAMS = R.PROGRAMS.map((p) => p[0]);          /* degrees */
const DEPARTMENTS = R.DEPARTMENTS.map((d) => d[0]);    /* a Department Chair's "program" is the department code */
const normEmail = (e) => String(e || '').trim().toLowerCase();

/** url: postgres://app_scgss:PASSWORD@127.0.0.1:5432/app_scgss.  schema: optional, used by tests to keep each test in its own schema. */
function open({ url, schema }) {
  const pool = new Pool({ connectionString: url, max: 5, options: schema ? '-c search_path=' + schema : undefined });
  pool.on('error', (e) => console.error('[db] idle client error:', e.message));
  return pool;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS scgss_users (
    email      text PRIMARY KEY,
    role       text NOT NULL CHECK (role IN ('student','adviser','chair','assoc','dean','admin','sysadmin')),
    name       text NOT NULL DEFAULT '',
    program    text NOT NULL DEFAULT '',
    active     boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS kv (k text PRIMARY KEY, v text NOT NULL);
  CREATE TABLE IF NOT EXISTS dedupe (k text PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS apps (
    seq bigserial, id text PRIMARY KEY, ref text UNIQUE NOT NULL, student_email text NOT NULL, status text NOT NULL, data jsonb NOT NULL
  );
  CREATE INDEX IF NOT EXISTS apps_student ON apps (student_email);
  CREATE INDEX IF NOT EXISTS apps_status ON apps (status);
  CREATE TABLE IF NOT EXISTS notifs (seq bigserial, id text PRIMARY KEY, to_email text NOT NULL, data jsonb NOT NULL);
  CREATE INDEX IF NOT EXISTS notifs_to ON notifs (to_email);
  CREATE TABLE IF NOT EXISTS outbox (seq bigserial, id text PRIMARY KEY, data jsonb NOT NULL);
  CREATE TABLE IF NOT EXISTS files (id text PRIMARY KEY, app_id text, data jsonb NOT NULL);
  CREATE TABLE IF NOT EXISTS drafts (email text PRIMARY KEY, data jsonb NOT NULL);
  CREATE TABLE IF NOT EXISTS sigs (email text PRIMARY KEY, data text NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (
    id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), email text NOT NULL DEFAULT '',
    event text NOT NULL, detail text NOT NULL DEFAULT '', ip text NOT NULL DEFAULT ''
  );
`;

function makeStore(pool) {
  const users = new Map();
  const cache = { apps: new Map(), notifs: new Map(), outbox: new Map(), files: new Map(), kv: new Map(), dedupe: new Set() };
  const row = (r) => ({ email: r.email, role: r.role, name: r.name, program: r.program, active: r.active ? 1 : 0 });
  const q = (text, params) => pool.query(text, params);

  const store = {
    ROLES, PROGRAMS, DEPARTMENTS, pool,

    /** Create the tables if they are missing and load the people list. Safe to run on every start. */
    async init() {
      await q(SCHEMA);
      users.clear();
      (await q('SELECT email, role, name, program, active FROM scgss_users')).rows.forEach((r) => users.set(r.email, row(r)));
    },
    close: () => pool.end(),

    /* ----- people: read from memory, written to the database first ----- */
    getUser: (email) => users.get(normEmail(email)) || null,
    activeUser(email) { const u = users.get(normEmail(email)); return u && u.active === 1 ? u : null; },
    usersByRole: (role) => [...users.values()].filter((u) => u.role === role && u.active === 1).sort((a, b) => (a.email < b.email ? -1 : 1)),
    listUsers: () => [...users.values()].sort((a, b) => (a.role + a.program + a.email < b.role + b.program + b.email ? -1 : 1)),
    async upsertUser({ email, role, name = '', program = '', active = true }) {
      email = normEmail(email);
      role = String(role || '').trim().toLowerCase();
      program = String(program || '').trim().toUpperCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
      if (!ROLES.includes(role)) throw new Error('Role must be one of: ' + ROLES.join(', '));
      if (role === 'chair' && !DEPARTMENTS.includes(program)) throw new Error('A Department Chair needs a department: ' + DEPARTMENTS.join(', ') + '.');
      if (role === 'student' && program && !PROGRAMS.includes(program)) throw new Error('Degree must be one of: ' + PROGRAMS.join(', ') + '.');
      if (role !== 'chair' && role !== 'student') program = '';
      const r = (await q(`INSERT INTO scgss_users (email, role, name, program, active) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (email) DO UPDATE SET role = $2, name = $3, program = $4, active = $5, updated_at = now()
        RETURNING email, role, name, program, active`, [email, role, String(name).trim(), program, !!active])).rows[0];
      users.set(email, row(r));
      return users.get(email);
    },
    async setActive(email, active) {
      email = normEmail(email);
      const n = (await q('UPDATE scgss_users SET active = $2, updated_at = now() WHERE email = $1', [email, !!active])).rowCount;
      if (n && users.has(email)) users.get(email).active = active ? 1 : 0;
      return n;
    },

    /* ----- audit, drafts, remembered signatures ----- */
    audit: (email, event, detail = '', ip = '') => q('INSERT INTO audit (email, event, detail, ip) VALUES ($1,$2,$3,$4)', [normEmail(email), event, String(detail).slice(0, 300), ip || '']).catch((e) => console.error('[audit]', e.message)),
    async lastAudit(n = 50) { return (await q('SELECT ts, email, event, detail, ip FROM audit ORDER BY id DESC LIMIT $1', [n])).rows; },
    async getSig(email) { const r = (await q('SELECT data FROM sigs WHERE email = $1', [normEmail(email)])).rows[0]; return r ? r.data : null; },
    putSig: (email, data) => q('INSERT INTO sigs (email, data) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET data = $2', [normEmail(email), String(data)]),
    async getDraft(email) { const r = (await q('SELECT data FROM drafts WHERE email = $1', [normEmail(email)])).rows[0]; return r ? r.data : null; },
    putDraft: (email, d) => q('INSERT INTO drafts (email, data) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET data = $2', [normEmail(email), JSON.stringify(d)]),
    delDraft: (email) => q('DELETE FROM drafts WHERE email = $1', [normEmail(email)]),

    /** Load everything the engine needs into one in-memory state object. */
    async loadAll() {
      Object.values(cache).forEach((c) => c.clear());
      const st = { seq: 0, counters: {}, keys: {}, apps: [], notifs: [], outbox: [], files: {} };
      (await q('SELECT k, v FROM kv')).rows.forEach((r) => cache.kv.set(r.k, r.v));
      st.seq = Number(cache.kv.get('seq') || 0);
      st.counters = JSON.parse(cache.kv.get('counters') || '{}');
      (await q('SELECT k FROM dedupe')).rows.forEach((r) => { st.keys[r.k] = 1; cache.dedupe.add(r.k); });
      (await q('SELECT id, data FROM apps ORDER BY seq')).rows.forEach((r) => { st.apps.push(r.data); cache.apps.set(r.id, JSON.stringify(r.data)); });
      (await q('SELECT id, data FROM notifs ORDER BY seq DESC')).rows.forEach((r) => { st.notifs.push(r.data); cache.notifs.set(r.id, JSON.stringify(r.data)); });
      (await q('SELECT id, data FROM outbox ORDER BY seq DESC')).rows.forEach((r) => { st.outbox.push(r.data); cache.outbox.set(r.id, JSON.stringify(r.data)); });
      (await q('SELECT id, data FROM files')).rows.forEach((r) => { st.files[r.id] = r.data; cache.files.set(r.id, JSON.stringify(r.data)); });
      return st;
    },

    /** Write only what changed since the last commit, in one transaction. If it fails, nothing is written and the error is thrown. */
    async commit(st) {
      const c = await pool.connect(), after = [];
      const put = async (kind, id, obj, sql, params) => { const s = JSON.stringify(obj); if (cache[kind].get(id) !== s) { await c.query(sql, params(s)); after.push(() => cache[kind].set(id, s)); } };
      try {
        await c.query('BEGIN');
        for (const a of st.apps) await put('apps', a.id, a, 'INSERT INTO apps (id, ref, student_email, status, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET ref = $2, student_email = $3, status = $4, data = $5', (s) => [a.id, a.ref, a.studentEmail, a.status, s]);
        for (const n of st.notifs) await put('notifs', n.id, n, 'INSERT INTO notifs (id, to_email, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET data = $3', (s) => [n.id, n.to, s]);
        for (const m of st.outbox.slice(0, 200)) await put('outbox', m.id, m, 'INSERT INTO outbox (id, data) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data = $2', (s) => [m.id, s]);
        for (const f of Object.values(st.files)) await put('files', f.id, f, 'INSERT INTO files (id, app_id, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET app_id = $2, data = $3', (s) => [f.id, f.appId || null, s]);
        const kv = async (k, v) => { if (cache.kv.get(k) !== v) { await c.query('INSERT INTO kv (k, v) VALUES ($1,$2) ON CONFLICT (k) DO UPDATE SET v = $2', [k, v]); after.push(() => cache.kv.set(k, v)); } };
        await kv('seq', String(st.seq)); await kv('counters', JSON.stringify(st.counters));
        for (const k of Object.keys(st.keys)) if (!cache.dedupe.has(k)) { await c.query('INSERT INTO dedupe (k) VALUES ($1) ON CONFLICT DO NOTHING', [k]); after.push(() => cache.dedupe.add(k)); }
        if (after.length) await c.query('DELETE FROM outbox WHERE id NOT IN (SELECT id FROM outbox ORDER BY seq DESC LIMIT 500)');
        await c.query('COMMIT');
        after.forEach((f) => f());
      } catch (e) {
        try { await c.query('ROLLBACK'); } catch (e2) { /* connection already gone */ }
        throw e;
      } finally { c.release(); }
    }
  };
  return store;
}

module.exports = { open, makeStore, normEmail, ROLES, PROGRAMS, DEPARTMENTS };
