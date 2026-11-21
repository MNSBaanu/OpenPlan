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
exports.proj = async pg => { await pg.waitForTimeout(450); return pg.evaluate(() => JSON.parse(localStorage.getItem('openplan.project'))); };
exports.confirm = async pg => { await pg.waitForSelector('dialog[open]'); await pg.locator('dialog[open] .btn.primary').click(); await pg.waitForTimeout(250); };
exports.toast = pg => pg.evaluate(() => (document.querySelector('.toast.show') || {}).textContent || '');
exports.row = (pg, n) => pg.locator('table.grid tbody tr:nth-child(' + n + ') td.id').first().click();
exports.tab = (pg, t) => pg.locator('.ribbon-tabs .rtab', { hasText: t }).click();
