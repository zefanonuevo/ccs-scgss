'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { open, makeStore } = require('./db');
const { createEngine } = require('./engine');
const { createGas } = require('./gas');
const { createApp, portalChecker } = require('./app');

/* read server/.env if present (KEY=VALUE per line); real environment variables win */
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env */ }

const env = process.env;
const dataDir = env.DATA_DIR || path.join(__dirname, 'data');
const filesDir = path.join(dataDir, 'files');
fs.mkdirSync(filesDir, { recursive: true });
const store = makeStore(open(path.join(dataDir, 'scgss.db')));
const gas = createGas({ url: env.GAS_URL, token: env.GAS_TOKEN, filesDir });
const engine = createEngine({ store, gas });
const app = createApp({
  store, engine, gas, me: portalChecker(env.PORTAL_URL || 'http://127.0.0.1:3000'),
  config: { baseUrl: env.BASE_URL || '', filesDir, allowedDomain: env.ALLOWED_DOMAIN || 'dlsu.edu.ph' }
});

/* automatic reminders: checked every hour; each reminder carries a key, so it is never sent twice */
function remind() { try { const n = engine.autoRemind(); if (n) console.log('[remind]', n, 'reminder(s) sent'); } catch (e) { console.error('[remind]', e); } }
remind(); setInterval(remind, 60 * 60 * 1000).unref();

const port = Number(env.PORT || 3001), host = env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log('SCGSS listening on ' + host + ':' + port + (gas.live() ? ' (Google sync on)' : ' (Google sync off)')));
