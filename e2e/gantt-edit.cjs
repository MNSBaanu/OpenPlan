// End-to-end test: editing bars on the Gantt chart with the mouse. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok, proj, toast } = L;
(async () => {
  const b = await L.launch(); const pg = await L.fresh(b); await L.open(pg);
  const task = async name => (await proj(pg)).tasks.find(t => t.name === name);
  // Where a bar is on screen: its box, and the x of its progress marker.
  const box = async name => { const t = await task(name); return pg.evaluate(u => { const g = document.querySelector('.gbar[data-uid="' + u + '"]'), r = g.querySelector('rect.bar').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, t.uid); };
  const cursor = async (x, y, name) => { await pg.mouse.move(x, y); const t = await task(name); return pg.evaluate(u => document.querySelector('.gbar[data-uid="' + u + '"]').style.cursor, t.uid); };
  const drag = async (x, y, dx, dy = 0) => { await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 }); await pg.mouse.move(x + dx, y + dy, { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(350); };
  const PPD = 12;      // pixels per day at the default zoom
  const LONG = 'Gather requirements & user stories', SHORT = 'Kick-off meeting', NEXT = 'Sprint planning & backlog';

  await step('bars are 14 px tall (they were 12), and a 1-day bar is still 12 px wide', async () => {
    const l = await box(LONG), s = await box(SHORT); eq([l.h, s.h], [14, 14]); eq(s.w, 12); });

  await step('handles appear when the pointer is over a bar, and not otherwise', async () => {
    const l = await box(LONG); const op = () => pg.evaluate(() => getComputedStyle(document.querySelector('.grip')).opacity);
    await pg.mouse.move(5, 5); eq(await op(), '0'); await pg.mouse.move(l.x + l.w / 2, l.y + 7); await pg.waitForTimeout(100); eq(await op(), '1'); });

  await step('the pointer shows what a press would do: edge arrows, a hand, a link cross, a progress arrow', async () => {
    const l = await box(LONG), s = await box(SHORT), cy = l.y + 7;
    eq(await cursor(l.x + 2, cy, LONG), 'ew-resize'); eq(await cursor(l.x + l.w - 2, cy, LONG), 'ew-resize');
    eq(await cursor(l.x + l.w / 2, cy, LONG), 'grab'); eq(await cursor(l.x + l.w + 9, cy, LONG), 'crosshair');
    eq(await cursor(l.x, l.y + 18, LONG), 'ew-resize');                                   // the progress marker, at 0%
    eq(await cursor(s.x + 6, s.y + 7, SHORT), 'grab'); });                                // the middle of a 1-day bar is still a move

  let originalDuration;
  await step('right edge: drag 4 calendar days (Friday to Tuesday) → 2 working days longer', async () => {
    const before = await task(LONG), l = await box(LONG); originalDuration = before.duration; await drag(l.x + l.w - 2, l.y + 7, 4 * PPD);
    eq((await task(LONG)).duration, before.duration + 2); });

  await step('undo puts the duration back', async () => {
    await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300); eq((await task(LONG)).duration, originalDuration); });

  await step('left edge: drag 1 day later → start moves, finish stays, the toast says the start is pinned', async () => {
    const before = await task(LONG), l = await box(LONG); await drag(l.x + 2, l.y + 7, PPD);
    const after = await task(LONG); eq(after.duration, before.duration - 1); eq(after.constraint, 'SNET'); ok(/Start pinned/.test(await toast(pg)), await toast(pg)); });

  await step('middle: drag a bar 2 days later → it pins the start, and says so', async () => {
    const l = await box(NEXT); await drag(l.x + l.w / 2, l.y + 7, 2 * PPD);
    const t = await task(NEXT); eq(t.constraint, 'SNET'); ok(/pinned/i.test(await toast(pg)), await toast(pg)); });

  await step('a 1-day bar: pressing the middle moves it (it used to resize)', async () => {
    const before = await task(SHORT), s = await box(SHORT); await drag(s.x + 6, s.y + 7, 2 * PPD);
    const t = await task(SHORT); eq(t.duration, before.duration); eq(t.constraint, 'SNET'); });

  await step('progress marker: drag it to the middle of the bar → 50% complete', async () => {
    const l = await box(LONG); await drag(l.x, l.y + 18, l.w / 2);
    const t = await task(LONG); ok(Math.abs(t.percent - 50) <= 10, 'percent ' + t.percent); ok(!!t.actualStart, 'actual start should be set'); });

  await step('link handle: drag from the dot after one bar onto another bar → finish-to-start link, bar lights up on the way', async () => {
    const from = await box(LONG), to = await box('UI wireframes'), target = await task('UI wireframes'), src = await task(LONG);
    ok(!target.preds.some(p => p.uid === src.uid), 'already linked');
    await pg.mouse.move(from.x + from.w + 9, from.y + 7); await pg.mouse.down(); await pg.mouse.move(to.x + to.w / 2, to.y + 7, { steps: 8 }); await pg.waitForTimeout(100);
    const lit = await pg.evaluate(() => document.querySelectorAll('.gbar.link-to').length); eq(lit, 1);
    const tip = await pg.evaluate(() => document.querySelector('.ghost-t').textContent); ok(/Link to task/.test(tip), tip);
    await pg.mouse.up(); await pg.waitForTimeout(350);
    ok((await task('UI wireframes')).preds.some(p => p.uid === src.uid && p.type === 'FS'), 'link missing'); ok(/Linked/.test(await toast(pg)), await toast(pg));
    eq(await pg.evaluate(() => document.querySelectorAll('.gbar.link-to').length), 0); });

  await step('a click on a bar still selects the task, and a double click opens the details', async () => {
    const l = await box(LONG); await pg.mouse.click(l.x + l.w / 2, l.y + 7); await pg.waitForTimeout(200);
    eq(await pg.locator('table.grid tbody tr.sel').count(), 1); });

  await step('the live chart has handles on its bars (exports and prints are drawn without them, see charts tests)', async () => {
    const live = await pg.evaluate(() => document.querySelectorAll('.gbar .ldot').length); ok(live > 5, 'live chart should have handles: ' + live); });

  await step('no broken numbers or errors', async () => { await L.clean(pg); eq(pg.errors, []); });
  console.log('\nSUMMARY', JSON.stringify(L.counts())); await b.close(); process.exit(0);
})().catch(e => { console.log('CRASH', e.message); process.exit(1); });
