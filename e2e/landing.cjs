// End-to-end test: drives the built app in a real browser. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok } = L;
(async () => {
  const b = await L.launch(); const pg = await L.fresh(b); const failed = []; pg.on('requestfailed', r => failed.push(r.url())); await L.open(pg, '');
  await step('landing: 5 preview tabs each show a loaded, full-size screenshot', async () => { const seen = [];
    for (const t of ['Gantt chart', 'Network diagram', 'WBS', 'Budget', 'Reports']) { await pg.locator('.lp-tabs button', { hasText: t }).click(); await pg.waitForTimeout(500); seen.push(await pg.evaluate(() => { const i = document.querySelector('.lp-shot img'); return i && i.complete && i.naturalWidth === 2400 && i.alt.length > 40 ? 'ok' : 'BROKEN'; })); }
    eq(seen, ['ok', 'ok', 'ok', 'ok', 'ok']); });
  await step('landing: image keeps its shape (no layout jump between tabs)', async () => { const hs = []; for (const t of ['Gantt chart', 'Budget', 'Reports']) { await pg.locator('.lp-tabs button', { hasText: t }).click(); await pg.waitForTimeout(300); hs.push(await pg.evaluate(() => Math.round(document.querySelector('.lp-shot img').getBoundingClientRect().height))); } ok(new Set(hs).size === 1, JSON.stringify(hs)); });
  await step('landing: no failed requests, no page errors', async () => { eq(failed, []); eq(pg.errors, []); });
  await step('landing: phone view scrolls the screenshot sideways and the page does not overflow', async () => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }); const p = await c.newPage(); await p.goto('http://localhost:4173/'); await p.waitForSelector('.landing'); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const l = document.querySelector('.landing'), s = document.querySelector('.lp-shot'); return { page: l.scrollWidth - l.clientWidth, shot: s.scrollWidth > s.clientWidth, img: document.querySelector('.lp-shot img').getBoundingClientRect().width }; });
    eq(r.page, 0); ok(r.shot && r.img >= 760, JSON.stringify(r)); await c.close(); });
  await step('landing: on phones the preview tabs are one line each, at least 44 px tall, and fit the screen', async () => {
    for (const w of [320, 360, 390, 430]) {
      const c = await b.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage(); await p.goto('http://localhost:4173/'); await p.waitForSelector('.lp-tabs'); await p.waitForTimeout(500);
      const r = await p.evaluate(() => [...document.querySelectorAll('.lp-tabs button')].map(x => { const q = x.getBoundingClientRect(), t = x.querySelector('span'), line = parseFloat(getComputedStyle(x).lineHeight) || 20; return { name: x.getAttribute('aria-label'), shown: x.innerText.trim(), h: Math.round(q.height), clipped: x.scrollWidth > x.clientWidth + 1, oneLine: t.getBoundingClientRect().height < line * 1.6, right: Math.round(q.right) }; }));
      ok(r.length === 5, w + 'px: expected 5 tabs'); for (const x of r) { ok(x.h >= 44, w + 'px ' + x.name + ' only ' + x.h + ' px tall'); ok(!x.clipped, w + 'px ' + x.name + ' is cut off'); ok(x.oneLine, w + 'px ' + x.name + ' wraps'); ok(x.right <= w, w + 'px ' + x.name + ' is off screen'); }
      eq(r.map(x => x.shown), ['Gantt', 'Network', 'WBS', 'Budget', 'Reports']); eq(r.map(x => x.name), ['Gantt chart', 'Network diagram', 'WBS', 'Budget', 'Reports']);
      await c.close();
    } });
  console.log('SUMMARY', JSON.stringify(L.counts())); await b.close();
})();
