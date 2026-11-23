// Shared helpers for the end-to-end tests.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
// Files the tests write (downloads, fixtures, screenshots) go here; it is ignored by git.
exports.OUT = path.join(__dirname, '.out') + path.sep;
fs.mkdirSync(exports.OUT, { recursive: true });
// Uses Playwright's own Chromium. Set E2E_CHROME to the path of another Chrome to use it instead.
exports.launch = async () => chromium.launch({ executablePath: process.env.E2E_CHROME || undefined, args: ['--no-sandbox'] });
exports.fresh = async (b, opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true, ...opts });
  await ctx.addInitScript(() => {
    delete window.showSaveFilePicker; delete window.showOpenFilePicker;
    window.print = () => { window.__printed = (window.__printed || 0) + 1; };
    if (!localStorage.getItem('openplan.ui')) localStorage.setItem('openplan.ui', JSON.stringify({ guide: false }));
  });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.errors = [];
  pg.on('pageerror', e => pg.errors.push('PAGEERROR ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') pg.errors.push('CONSOLE ' + m.text().slice(0, 200)); });
  return pg;
};
exports.open = async (pg, hash = '#app') => { await pg.goto('http://localhost:4173/' + hash); await pg.waitForSelector(hash === '#app' ? '.ribbon-tabs' : '.landing'); await pg.waitForTimeout(400); };
exports.state = async pg => pg.evaluate(() => ({
  dialog: (document.querySelector('dialog[open] h2') || {}).textContent || null,
  menu: [...document.querySelectorAll('.menu.open [role=menuitem], .menu.open button')].map(e => e.textContent.trim()).filter(Boolean),
  toast: (document.querySelector('.toast.show') || {}).textContent || null,
  view: (document.querySelector('.viewbar span') || {}).textContent || null,
  backstage: !!document.querySelector('.backstage:not([hidden])'),
}));
let P = 0, F = 0; exports.counts = () => ({ pass: P, fail: F });
exports.step = async (name, fn) => { try { const r = await fn(); P++; console.log('PASS ' + name + (r ? '  → ' + r : '')); } catch (e) { F++; console.log('FAIL ' + name + '  → ' + e.message.split('\n')[0].slice(0, 170)); } };
exports.eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); };
exports.ok = (c, m) => { if (!c) throw new Error(m); };
// visible text must not contain broken numbers
exports.clean = async pg => { const t = await pg.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('svg text')].map(e => e.textContent).join(' ')); const m = t.match(/NaN|undefined|Infinity|\[object|Invalid Date/g); if (m) throw new Error('broken text: ' + [...new Set(m)].join(',')); };
// Autosave is debounced (~300 ms) and timers/storage sync can run late on a loaded CI machine,
// so keep reading until the stored project has stayed identical for a while — a single fixed
// wait can race the flush and see the pre-save value.
exports.proj = async pg => {
  let last = null, quiet = 0;
  for (const end = Date.now() + 10000; Date.now() < end;) {
    const text = await pg.evaluate(() => localStorage.getItem('openplan.project'));
    if (text === last) { if (++quiet >= 6) break; } else quiet = 0;
    last = text;
    await pg.waitForTimeout(140);
  }
  return JSON.parse(last);
};
// Poll fn until it returns truthy or the deadline passes; throws m (with the last value) on timeout.
exports.until = async (fn, ms = 6000, m = 'condition') => { const end = Date.now() + ms; let v; while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch {} await new Promise(r => setTimeout(r, 120)); } throw new Error(m + ' (last: ' + v + ')'); };
exports.confirm = async pg => { await pg.waitForSelector('dialog[open]'); await pg.locator('dialog[open] .btn.primary').click(); await pg.waitForTimeout(250); };
exports.toast = pg => pg.evaluate(() => (document.querySelector('.toast.show') || {}).textContent || '');
exports.row = (pg, n) => pg.locator('table.grid tbody tr:nth-child(' + n + ') td.id').first().click();
exports.tab = (pg, t) => pg.locator('.ribbon-tabs .rtab', { hasText: t }).click();
