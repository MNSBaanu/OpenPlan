// End-to-end test: every view can be scrolled with a finger on a phone, in both directions of the screen.
// Uses real touch input (not scrolling by script), so a layout that cannot scroll is caught. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, ok } = L;
(async () => {
  const b = await L.launch();
  const pg = await L.fresh(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cdp = await pg.context().newCDPSession(pg);
  await L.open(pg);
  // A long plan, so every list and report is taller than the screen.
  await pg.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('openplan.project')); let u = 100000;
    const t0 = p.tasks.find(t => !t.summary && t.level >= 2) || p.tasks[1], r0 = p.resources[0];
    for (let i = 0; i < 50; i++) p.tasks.push({ ...JSON.parse(JSON.stringify(t0)), uid: ++u, name: 'Extra task ' + (i + 1), preds: [], assignments: [] });
    for (let i = 0; i < 20; i++) p.resources.push({ ...JSON.parse(JSON.stringify(r0)), uid: ++u, name: 'Extra person ' + (i + 1), initials: 'X' + i });
    localStorage.setItem('openplan.project', JSON.stringify(p));
  });
  await pg.reload(); await pg.waitForSelector('.ribbon-tabs'); await pg.waitForTimeout(600);
  // One finger, dragged up the screen like a person scrolling down.
  const drag = async (x, y, dy) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / 12 }] }); await pg.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(450);
  };
  const scrolledBy = sel => pg.evaluate(s => Math.round(Math.max(0, ...[...document.querySelectorAll(s)].map(e => e.scrollTop))), sel);
  const scrollsOn = async (sel, label) => {
    await pg.evaluate(s => document.querySelectorAll(s).forEach(e => { e.scrollTop = 0; }), sel);
    // Put the finger on the first box of this kind that has more to show than fits (on the board, the first column).
    const at = await pg.evaluate(s => {
      const e = [...document.querySelectorAll(s)].find(x => x.scrollHeight > x.clientHeight + 2); if (!e) return null;
      const r = e.getBoundingClientRect(), top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight), left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
      return { x: Math.round((left + right) / 2), y: Math.round(top + (bottom - top) * 0.7), h: Math.round(bottom - top) };
    }, sel);
    ok(at, label + ' has nothing taller than its box to scroll');
    await drag(at.x, at.y, -Math.max(60, Math.round(at.h * 0.6)));
    const moved = await scrolledBy(sel); ok(moved > 0, label + ' did not scroll with a finger');
    return label + ' scrolled ' + moved + ' px';
  };
  const status = n => pg.locator('.statusbar button[title="' + n + '"], .statusbar button[aria-label="' + n + '"]').first().click();
  const views = [
    ['Gantt table', () => status('Gantt Chart'), '.grid-pane'],
    ['Task board', () => status('Task Board'), '.board-cards'],
    ['Resource sheet', () => status('Resource Sheet'), '.scroll'],
    ['Network diagram', () => status('Network Diagram'), '.canvas']
  ];
  for (const orientation of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
    await pg.setViewportSize({ width: orientation[0], height: orientation[1] }); await pg.waitForTimeout(500);
    for (const [name, open, sel] of views) await step(orientation[2] + ': ' + name + ' scrolls with a finger', async () => { await open(); await pg.waitForTimeout(500); return scrollsOn(sel, name); });
    await status('Reports'); await pg.waitForTimeout(500);
    for (const rep of ['Project overview', 'Critical tasks', 'Cost overview', 'Task list'])
      await step(orientation[2] + ': report "' + rep + '" scrolls with a finger', async () => { await pg.locator('.rpt-nav button', { hasText: rep }).first().click(); await pg.waitForTimeout(400); return scrollsOn('.paper', rep); });
  }
  console.log('\nSUMMARY', JSON.stringify(L.counts()), 'errors', JSON.stringify(pg.errors)); await b.close();
})().catch(e => { console.log('CRASH ' + e.message.split('\n')[0]); process.exit(1); });
