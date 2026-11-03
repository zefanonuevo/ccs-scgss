'use strict';
/* SCGSS HTTP server.
   Sign-in is the portal's: the browser's portal cookie is forwarded to the portal's /api/me on this machine, which says who is signed in.
   Access is SCGSS's own: that email must be listed, and switched on, in the scgss_users table. Anyone else gets 403. */
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const MAX_FILE = 20 * 1024 * 1024;
/** juan_dela_cruz@dlsu.edu.ph: letters/digits/hyphens, at least one underscore, no dot before the @, and the allowed domain. */
const isStudentEmail = (email, domain) => { const m = /^([a-z0-9_-]+)@(.+)$/.exec(String(email || '').toLowerCase()); return !!m && m[1].indexOf('_') > 0 && (!domain || m[2] === domain); };
const FILE_TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.txt': 'text/plain' };

/** Production: ask the portal who this cookie belongs to. Returns {signedIn, email, name} or {signedIn:false}. */
function portalChecker(portalUrl, ttlMs = 10000) {
  const memo = new Map();
  return async function me(cookieHeader) {
    if (!cookieHeader) return { signedIn: false };
    const hit = memo.get(cookieHeader);
    if (hit && Date.now() - hit.at < ttlMs) return hit.v;
    let v = { signedIn: false };
    try {
      const res = await fetch(portalUrl.replace(/\/$/, '') + '/api/me', { headers: { cookie: cookieHeader }, signal: AbortSignal.timeout(4000) });
      const j = await res.json();
      if (j && j.ok && j.signedIn && j.email) v = { signedIn: true, email: String(j.email).toLowerCase(), name: j.name || '' };
    } catch (e) { v = { signedIn: false, unreachable: true }; }
    if (!v.unreachable) { memo.set(cookieHeader, { at: Date.now(), v }); if (memo.size > 2000) memo.clear(); }
    return v;
  };
}

function createApp({ store, engine, gas, me, config }) {
  const cfg = Object.assign({ siteRoot: path.resolve(__dirname, '..'), filesDir: path.resolve(__dirname, 'data/files'), baseUrl: '', autoStudents: true }, config);
  fs.mkdirSync(cfg.filesDir, { recursive: true });
  const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store' });
    next();
  });

  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  /* ---------- who is asking ---------- */
  async function who(req, res, next) {  // eslint-disable-line
    const p = await me(req.headers.cookie || '');
    if (!p.signedIn) return res.status(401).json({ ok: false, error: p.unreachable ? 'The portal sign-in service is not reachable. Try again shortly.' : 'Sign in to the portal first.', signedIn: false });
    let u = store.activeUser(p.email);
    /* A student's email looks like juan_dela_cruz@dlsu.edu.ph (underscores, no dots). A student who is not listed yet is added as a Student on first visit.
       Staff emails look like maria.delacruz@dlsu.edu.ph (a dot): they must be listed by the System Administrator. A person who was switched off stays off. */
    if (!u && cfg.autoStudents && !store.getUser(p.email) && isStudentEmail(p.email, cfg.allowedDomain)) {
      u = await store.upsertUser({ email: p.email, role: 'student', name: p.name || '', program: '', active: true });
      await store.audit(p.email, 'student_auto', 'added as a student on first sign-in', req.ip);
    }
    if (!u) { await store.audit(p.email, 'no_access', 'not listed or switched off', req.ip); return res.status(403).json({ ok: false, error: 'Your account is not set up for the Grant Support System. Ask the System Administrator to add you.', signedIn: true, email: p.email, enrolled: false }); }
    req.user = engine.decorate(u);
    if (!req.user.name || req.user.name === req.user.email) req.user.name = p.name || req.user.email;
    next();
  }
  function sameOrigin(req, res, next) {
    const origin = req.get('origin');
    const expected = cfg.baseUrl ? new URL(cfg.baseUrl).origin : req.protocol + '://' + req.get('host');
    if (origin !== expected) return res.status(403).json({ ok: false, error: 'Request not allowed from this address.' });
    next();
  }
  const sysadminOnly = (req, res, next) => (req.user.role === 'sysadmin' ? next() : res.status(403).json({ ok: false, error: 'Only the System Administrator can do this.' }));

  /* ---------- state and actions ---------- */
  app.get('/api/state', who, ah(async (req, res) => res.json({ ok: true, state: await engine.snapshotFor(req.user) })));

  app.post('/api/action', sameOrigin, who, express.json({ limit: '2mb' }), ah(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || ''), args = Array.isArray(b.args) ? b.args : [];
    let result;
    try { result = await engine.run(req.user, name, b.appId ? String(b.appId) : '', args); } catch (e) { console.error('[action]', name, e); result = { err: 'Something went wrong on the server. Nothing was saved.' }; }
    if (result && result.err) await store.audit(req.user.email, 'action_refused', name + ': ' + result.err, req.ip);
    const out = Object.assign({}, result); delete out.app;
    if (result && result.app) out.appId = result.app.id;
    res.json({ ok: !(result && result.err), result: out, state: await engine.snapshotFor(req.user) });
  }));

  /* ---------- files ---------- */
  app.post('/api/files', sameOrigin, who, express.raw({ type: '*/*', limit: MAX_FILE }), ah(async (req, res) => {
    const orig = path.basename(decodeURIComponent(String(req.get('x-file-name') || 'upload.pdf'))).slice(0, 120);
    const ext = path.extname(orig).toLowerCase();
    if (!FILE_TYPES[ext]) return res.status(400).json({ ok: false, error: 'This file type is not accepted. Use PDF, PNG, JPG, DOCX, XLSX or TXT.' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ ok: false, error: 'The file is empty.' });
    if (ext === '.pdf' && req.body.subarray(0, 5).toString('latin1') !== '%PDF-') return res.status(400).json({ ok: false, error: 'This does not look like a PDF file.' });
    const meta = await engine.registerFile({ orig, size: req.body.length, type: FILE_TYPES[ext], by: req.user.name, byEmail: req.user.email });
    fs.writeFileSync(path.join(cfg.filesDir, meta.id), req.body);
    res.json({ ok: true, file: { id: meta.id, orig: meta.orig, size: meta.size } });
  }));
  app.get('/api/files/:id', who, (req, res) => {
    const id = String(req.params.id);
    const f = /^f\d+$/.test(id) ? engine.db.files[id] : null;
    const a = f && f.appId ? engine.byId(f.appId) : null;
    const allowed = f && (a ? engine.mayView(req.user, a) : f.byEmail === req.user.email);
    if (!allowed) return res.status(404).json({ ok: false, error: 'File not found.' });
    const p = path.join(cfg.filesDir, id);
    if (!fs.existsSync(p)) return res.status(404).json({ ok: false, error: 'The stored file is missing.' });
    res.set({ 'Content-Type': f.type || 'application/octet-stream', 'Content-Disposition': (req.query.download ? 'attachment' : 'inline') + '; filename="' + String(f.name || f.orig).replace(/[^\w.\-]+/g, '_') + '"', 'Cache-Control': 'private, no-store' });
    fs.createReadStream(p).pipe(res);
  });

  /* ---------- drafts and the remembered signature ---------- */
  app.post('/api/draft', sameOrigin, who, express.json({ limit: '256kb' }), ah(async (req, res) => {
    if (req.body && req.body.clear) await store.delDraft(req.user.email); else await store.putDraft(req.user.email, req.body && req.body.form || {});
    res.json({ ok: true });
  }));
  app.post('/api/sig', sameOrigin, who, express.json({ limit: '256kb' }), ah(async (req, res) => {
    const d = req.body && req.body.data;
    if (typeof d !== 'string' || d.indexOf('data:image') !== 0) return res.status(400).json({ ok: false, error: 'Not a signature image.' });
    await store.putSig(req.user.email, d); res.json({ ok: true });
  }));

  /* ---------- roles: System Administrator only ---------- */
  app.get('/api/users', who, sysadminOnly, ah(async (req, res) => res.json({ ok: true, users: store.listUsers(), roles: store.ROLES, programs: store.PROGRAMS, departments: store.DEPARTMENTS, audit: await store.lastAudit(30) })));
  app.post('/api/users', sameOrigin, who, sysadminOnly, express.json({ limit: '32kb' }), ah(async (req, res) => {
    const b = req.body || {};
    try {
      const email = String(b.email || '').trim().toLowerCase(), role = String(b.role || '').trim().toLowerCase();
      const dom = cfg.allowedDomain;
      if (dom && !email.endsWith('@' + dom)) throw new Error('Use an @' + dom + ' address.');
      const was = store.getUser(email), active = b.active !== false;
      const program = String(b.program || '').toUpperCase();
      /* one Dean, one Associate Dean, one Department Chair per department */
      if (active && (role === 'dean' || role === 'assoc' || role === 'chair')) {
        const other = store.usersByRole(role).find((u) => u.email !== email && (role !== 'chair' || u.program === program));
        if (other) throw new Error((other.name || other.email) + ' is already the ' + ({ dean: 'Dean', assoc: 'Associate Dean', chair: 'Department Chair for ' + program }[role]) + '. Switch them off or change their role first.');
      }
      /* the last active System Administrator cannot be demoted or switched off */
      if (was && was.role === 'sysadmin' && was.active === 1 && (role !== 'sysadmin' || !active) && store.usersByRole('sysadmin').length < 2) throw new Error('There must be at least one active System Administrator.');
      const u = await store.upsertUser({ email, role, name: b.name, program, active });
      await store.audit(req.user.email, 'user_set', email + ' role=' + u.role + (u.program ? ' program=' + u.program : '') + ' active=' + u.active, req.ip);
      res.json({ ok: true, user: u, users: store.listUsers() });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  }));

  /* ---------- the page itself: an explicit list, nothing else in the repo is served ---------- */
  /* Cloudflare puts a 30-minute browser cache on .js files, so every script address carries a version that changes whenever a file changes. */
  const SCRIPTS = ['js/core.js', 'js/pdf.js', 'js/ui.js', 'js/ui2.js', 'js/theme.js', 'js/theme-early.js', 'js/start.js', 'shared/rules.js'];
  const buildTag = () => SCRIPTS.reduce((m, f) => { try { return Math.max(m, fs.statSync(path.join(cfg.siteRoot, f)).mtimeMs); } catch (e) { return m; } }, 0).toString(36);
  app.get('/', (req, res) => {
    let html;
    try { html = fs.readFileSync(path.join(cfg.siteRoot, 'index.html'), 'utf8'); } catch (e) { return res.status(404).type('text').send('Not found'); }
    const v = buildTag();
    html = html.replace(/(src="(?:js\/[\w-]+|shared\/rules)\.js)"/g, '$1?v=' + v + '"');
    res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/html; charset=utf-8' }).send(html);
  });
  app.use('/js', express.static(path.join(cfg.siteRoot, 'js'), { dotfiles: 'deny', index: false, redirect: false, setHeaders: (r) => r.set('Cache-Control', 'no-cache') }));
  app.get('/shared/rules.js', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(cfg.siteRoot, 'shared/rules.js')));
  app.use((req, res) => res.status(404).type('text').send('Not found'));
  app.use((err, req, res, next) => { console.error('[error]', req.method, req.path, err); if (res.headersSent) return next(err); res.status(500).json({ ok: false, error: 'Something went wrong on the server. Nothing was saved.' }); });
  return app;
}

module.exports = { createApp, portalChecker, FILE_TYPES, isStudentEmail };
