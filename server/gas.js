'use strict';
/* Link to the Google Apps Script web app (google/Code.gs): Sheet rows, Drive files and email.
   Calls go out one at a time so the script's lock is never contended. A failure is logged and never blocks an action. */
const fs = require('node:fs');
const path = require('node:path');

function createGas({ url, token, filesDir, log = console }) {
  const queue = []; let busy = false;
  async function pump() {
    if (busy) return; busy = true;
    while (queue.length) {
      const job = queue.shift();
      try {
        const body = await job();
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token }, body)), redirect: 'follow' });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j || j.ok !== true) log.error('[gas] rejected:', res.status, j && j.error);
      } catch (e) { log.error('[gas] failed:', e.message); }
    }
    busy = false;
  }
  return {
    live: () => !!(url && token),
    post(p) { if (!url || !token) return; queue.push(async () => p); pump(); },
    pushFile(f) {
      if (!url || !token) return;
      queue.push(async () => ({ action: 'file', folder: f.folder, name: f.name, mime: f.type, b64: (await fs.promises.readFile(path.join(filesDir, f.id))).toString('base64') }));
      pump();
    },
    idle: () => new Promise((r) => { const t = setInterval(() => { if (!busy && !queue.length) { clearInterval(t); r(); } }, 20); })
  };
}
module.exports = { createGas };
