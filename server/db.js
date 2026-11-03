'use strict';
/* SQLite storage for SCGSS: roles (scgss_users), applications, files, notices, audit log.
   The engine keeps the working state in memory and calls commit() after every action; commit() writes only what changed. */
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

const ROLES = ['student', 'adviser', 'chair', 'assoc', 'dean', 'admin', 'sysadmin'];
const PROGRAMS = ['BSCS', 'BSIT', 'BSIS'];
const normEmail = (e) => String(e || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scgss_users (
      email      TEXT PRIMARY KEY,
      role       TEXT NOT NULL CHECK (role IN ('student','adviser','chair','assoc','dean','admin','sysadmin')),
      name       TEXT NOT NULL DEFAULT '',
      program    TEXT NOT NULL DEFAULT '',
      active     INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS dedupe (k TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY, ref TEXT NOT NULL, student_email TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS apps_student ON apps (student_email);
    CREATE TABLE IF NOT EXISTS notifs (id TEXT PRIMARY KEY, to_email TEXT NOT NULL, json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS notifs_to ON notifs (to_email);
    CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, app_id TEXT, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS drafts (email TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sigs (email TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
      event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT ''
    );
  `);
  return db;
}

function makeStore(db) {
  const q = {
    getUser: db.prepare('SELECT email, role, name, program, active FROM scgss_users WHERE email = ?'),
    upsertUser: db.prepare(`INSERT INTO scgss_users (email, role, name, program, active, updated_at) VALUES (@email, @role, @name, @program, @active, @ts)
      ON CONFLICT(email) DO UPDATE SET role = @role, name = @name, program = @program, active = @active, updated_at = @ts`),
    listUsers: db.prepare('SELECT email, role, name, program, active FROM scgss_users ORDER BY role, program, email'),
    byRole: db.prepare('SELECT email, role, name, program, active FROM scgss_users WHERE role = ? AND active = 1 ORDER BY email'),
    setActive: db.prepare('UPDATE scgss_users SET active = ?, updated_at = ? WHERE email = ?'),
    addAudit: db.prepare('INSERT INTO audit (ts, email, event, detail, ip) VALUES (?, ?, ?, ?, ?)'),
    lastAudit: db.prepare('SELECT ts, email, event, detail, ip FROM audit ORDER BY id DESC LIMIT ?'),
    getSig: db.prepare('SELECT data FROM sigs WHERE email = ?'),
    putSig: db.prepare('INSERT INTO sigs (email, data) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET data = excluded.data'),
    getDraft: db.prepare('SELECT json FROM drafts WHERE email = ?'),
    putDraft: db.prepare('INSERT INTO drafts (email, json) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET json = excluded.json'),
    delDraft: db.prepare('DELETE FROM drafts WHERE email = ?')
  };
  const cache = { apps: new Map(), notifs: new Map(), outbox: new Map(), files: new Map(), kv: new Map(), dedupe: new Set() };
  const up = {
    apps: db.prepare('INSERT INTO apps (id, ref, student_email, status, json) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ref = excluded.ref, student_email = excluded.student_email, status = excluded.status, json = excluded.json'),
    notifs: db.prepare('INSERT INTO notifs (id, to_email, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json'),
    outbox: db.prepare('INSERT INTO outbox (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json'),
    files: db.prepare('INSERT INTO files (id, app_id, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET app_id = excluded.app_id, json = excluded.json'),
    kv: db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
    dedupe: db.prepare('INSERT OR IGNORE INTO dedupe (k) VALUES (?)'),
    trimOutbox: db.prepare('DELETE FROM outbox WHERE id NOT IN (SELECT id FROM outbox ORDER BY rowid DESC LIMIT 500)')
  };

  const store = {
    ROLES, PROGRAMS,
    db,
    getUser: (email) => q.getUser.get(normEmail(email)) || null,
    /** The role for an email, or null when the person is not listed or is switched off. Read on every request. */
    activeUser(email) { const u = q.getUser.get(normEmail(email)); return u && u.active === 1 ? u : null; },
    usersByRole: (role) => q.byRole.all(role),
    listUsers: () => q.listUsers.all(),
    upsertUser({ email, role, name = '', program = '', active = true }) {
      email = normEmail(email);
      role = String(role || '').trim().toLowerCase();
      program = String(program || '').trim().toUpperCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
      if (!ROLES.includes(role)) throw new Error('Role must be one of: ' + ROLES.join(', '));
      if (role === 'chair' && !PROGRAMS.includes(program)) throw new Error('A Department Chair needs a program: ' + PROGRAMS.join(', ') + '.');
      if (role === 'student' && program && !PROGRAMS.includes(program)) throw new Error('Program must be one of: ' + PROGRAMS.join(', ') + '.');
      if (role !== 'chair' && role !== 'student') program = '';
      q.upsertUser.run({ email, role, name: String(name).trim(), program, active: active ? 1 : 0, ts: nowIso() });
      return q.getUser.get(email);
    },
    setActive(email, active) { return q.setActive.run(active ? 1 : 0, nowIso(), normEmail(email)).changes; },
    audit(email, event, detail = '', ip = '') { q.addAudit.run(nowIso(), normEmail(email), event, String(detail).slice(0, 300), ip); },
    lastAudit: (n = 50) => q.lastAudit.all(n),
    getSig: (email) => { const r = q.getSig.get(normEmail(email)); return r ? r.data : null; },
    putSig: (email, data) => q.putSig.run(normEmail(email), String(data)),
    getDraft: (email) => { const r = q.getDraft.get(normEmail(email)); return r ? JSON.parse(r.json) : null; },
    putDraft: (email, d) => q.putDraft.run(normEmail(email), JSON.stringify(d)),
    delDraft: (email) => q.delDraft.run(normEmail(email)),

    /** Load everything the engine needs into one in-memory state object. */
    loadAll() {
      const st = { seq: 0, counters: {}, keys: {}, apps: [], notifs: [], outbox: [], files: {} };
      db.prepare('SELECT k, v FROM kv').all().forEach((r) => { cache.kv.set(r.k, r.v); });
      st.seq = Number(cache.kv.get('seq') || 0);
      st.counters = JSON.parse(cache.kv.get('counters') || '{}');
      db.prepare('SELECT k FROM dedupe').all().forEach((r) => { st.keys[r.k] = 1; cache.dedupe.add(r.k); });
      db.prepare('SELECT id, json FROM apps ORDER BY rowid').all().forEach((r) => { st.apps.push(JSON.parse(r.json)); cache.apps.set(r.id, r.json); });
      db.prepare('SELECT id, json FROM notifs ORDER BY rowid DESC').all().forEach((r) => { st.notifs.push(JSON.parse(r.json)); cache.notifs.set(r.id, r.json); });
      db.prepare('SELECT id, json FROM outbox ORDER BY rowid DESC').all().forEach((r) => { st.outbox.push(JSON.parse(r.json)); cache.outbox.set(r.id, r.json); });
      db.prepare('SELECT id, json FROM files').all().forEach((r) => { st.files[r.id] = JSON.parse(r.json); cache.files.set(r.id, r.json); });
      return st;
    },

    /** Write only what changed since the last commit, in one transaction. */
    commit(st) {
      const tx = db.transaction(() => {
        const put = (kind, id, obj, write) => { const s = JSON.stringify(obj); if (cache[kind].get(id) !== s) { write(s); cache[kind].set(id, s); } };
        st.apps.forEach((a) => put('apps', a.id, a, (s) => up.apps.run(a.id, a.ref, a.studentEmail, a.status, s)));
        st.notifs.forEach((n) => put('notifs', n.id, n, (s) => up.notifs.run(n.id, n.to, s)));
        st.outbox.slice(0, 200).forEach((m) => put('outbox', m.id, m, (s) => up.outbox.run(m.id, s)));
        Object.values(st.files).forEach((f) => put('files', f.id, f, (s) => up.files.run(f.id, f.appId || null, s)));
        const kv = (k, v) => { if (cache.kv.get(k) !== v) { up.kv.run(k, v); cache.kv.set(k, v); } };
        kv('seq', String(st.seq)); kv('counters', JSON.stringify(st.counters));
        Object.keys(st.keys).forEach((k) => { if (!cache.dedupe.has(k)) { up.dedupe.run(k); cache.dedupe.add(k); } });
        up.trimOutbox.run();
      });
      tx();
    }
  };
  return store;
}

module.exports = { open, makeStore, normEmail, ROLES, PROGRAMS };
