// End-to-end test: pull down to reload on a phone-sized screen. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok } = L;
(async () => {
  const b = await L.launch();
  const pg = await L.fresh(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await L.open(pg);
  // Plays a one-finger drag with real touch events: from (x, y0) straight down by `dy` pixels, then lets go.
  const drag = (sel, dy, dx = 0, hold = false) => pg.evaluate(({ sel, dy, dx, hold }) => {
    const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + 60, y = r.top + r.height / 2;
    const touch = (cx, cy) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
    const fire = (type, cx, cy) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch(cx, cy)], changedTouches: [touch(cx, cy)] }));
    fire('touchstart', x, y);
    for (let i = 1; i <= 10; i++) fire('touchmove', x + (dx * i) / 10, y + (dy * i) / 10);
    const ptr = document.querySelector('.ptr');
    const info = { text: ptr.textContent, ready: ptr.dataset.ready, opacity: ptr.style.opacity };
    if (!hold) fire('touchend', x + dx, y + dy);
    return info;
  }, { sel, dy, dx, hold });
  const mark = () => pg.evaluate(() => { window.__still_here = 1; });
  const alive = () => pg.evaluate(() => window.__still_here === 1).catch(() => false);

  await step('a short pull shows "Pull down to reload" and does not reload', async () => {
    await mark(); const i = await drag('.titlebar', 50);
    eq(i.text, 'Pull down to reload'); eq(i.ready, '0'); await pg.waitForTimeout(900); ok(await alive(), 'page reloaded'); });
  await step('a long pull shows "Release to reload"', async () => {
    const i = await drag('.titlebar', 200, 0, true); eq(i.text, 'Release to reload'); eq(i.ready, '1');
    await pg.evaluate(() => document.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true }))); await pg.waitForTimeout(400); ok(await alive(), 'cancelled pull reloaded'); });
  await step('a sideways swipe on the tab row does not start a pull', async () => {
    const i = await drag('.ribbon-tabs', 8, -120, true);
    ok(i.opacity !== '1', 'indicator showed'); await pg.evaluate(() => document.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true }))); });
  await step('a pull that starts in the chart does not reload (so scrolling is safe)', async () => {
    await drag('.chart-pane, main', 220); await pg.waitForTimeout(900); ok(await alive(), 'chart pull reloaded'); });
  await step('a long pull on the title bar reloads the page, and the project is still there', async () => {
    const before = await L.proj(pg); const n = before.tasks.length;
    await drag('.titlebar', 220); await pg.waitForSelector('.ribbon-tabs'); await pg.waitForTimeout(600);
    ok(!(await alive()), 'page did not reload');
    eq((await L.proj(pg)).tasks.length, n, 'task count changed after reload'); });
  console.log('\nSUMMARY', JSON.stringify(L.counts()), 'errors', JSON.stringify(pg.errors));
  await b.close();
})().catch(e => { console.log('CRASH ' + e.message.split('\n')[0]); process.exit(1); });
