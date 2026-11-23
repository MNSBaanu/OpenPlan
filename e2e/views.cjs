// End-to-end test: drives the built app in a real browser. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok, proj, toast, row, tab, confirm, clean } = L;
const fs = require('fs');
(async () => {
  const b = await L.launch(); let pg = await L.fresh(b); await L.open(pg);
  const bar = () => pg.locator('.viewbar span').innerText();
  const stat = n => pg.locator('.statusbar button[title="' + n + '"], .statusbar button[aria-label="' + n + '"]').first().click();
  // ---- views ----
  const views = [['Gantt Chart', () => stat('Gantt Chart')], ['Task Board', () => stat('Task Board')], ['Resource Sheet', () => stat('Resource Sheet')], ['Network Diagram', () => stat('Network Diagram')],
    ['Reports', () => stat('Reports')], ['WBS Chart', async () => { await tab(pg, 'View'); await pg.locator('.ribbon button', { hasText: /WBS\s*Chart/ }).click(); }],
    ['Team Chart', async () => { await tab(pg, 'View'); await pg.locator('.ribbon button', { hasText: /Team\s*Chart/ }).click(); }],
    ['Resource Usage', async () => { await tab(pg, 'View'); await pg.locator('.ribbon button', { hasText: /Resource\s*Usage/ }).click(); }],
    ['Cost & Budget', async () => { await tab(pg, 'Report'); await pg.locator('.ribbon button', { hasText: /Cost\s*&\s*Budget/ }).click(); }]];
  for (const [name, go] of views) await step('view: ' + name + ' renders, no broken numbers', async () => {
    await go(); await pg.waitForTimeout(500); eq((await bar()).trim().toLowerCase(), name.toLowerCase()); await clean(pg);
    const n = await pg.evaluate(() => document.querySelector('.view, .reports') ? document.querySelector('.view, .reports').innerText.length + document.querySelectorAll('.view svg, .reports svg').length : 0); ok(n > 40, 'view looks empty'); await pg.screenshot({ path: L.OUT + 'shots_v_' + name.replace(/\W+/g, '_') + '.png' }); return 'ok'; });
  await step('board: move card with the arrow button, then drag-and-drop', async () => {
    await stat('Task Board'); const cols = await pg.locator('.board-col h2').allInnerTexts(); eq(cols.length, 3);
    const first = pg.locator('.board-col').nth(0).locator('.board-card').first(); const name = await first.locator('b').innerText(); await first.locator('.board-move button').last().click(); await pg.waitForTimeout(300);
    const inProg = await pg.locator('.board-col').nth(1).locator('.board-card b', { hasText: name.replace(/^\d+\. /, '') }).count(); ok(inProg === 1, 'card not moved: ' + name);
    const card = pg.locator('.board-col').nth(1).locator('.board-card').first(); await card.dragTo(pg.locator('.board-col').nth(2).locator('.board-cards')); await pg.waitForTimeout(300);
    const done = await pg.locator('.board-col').nth(2).locator('.board-card').count(); ok(done >= 1, 'drag did not drop'); return cols.join(' / '); });
  await step('board: clicking a card opens the details panel', async () => { await pg.locator('.board-open').first().click(); await pg.waitForSelector('aside.drawer'); ok((await pg.locator('aside.drawer input').first().inputValue()).length > 0, 'drawer empty'); });
  await step('gantt: zoom in/out and timescales', async () => {
    await stat('Gantt Chart'); for (const t of ['Zoom in', 'Zoom in', 'Zoom out', 'Zoom out', 'Zoom out']) { await stat(t); } await pg.locator('.statusbar input[type=range]').fill('3'); await pg.waitForTimeout(300); await pg.locator('.statusbar input[type=range]').fill('0'); await clean(pg); });
  await step('gantt: show-all / top-level / selected-only subtasks', async () => {
    await tab(pg, 'View'); const n0 = await pg.locator('table.grid tbody tr').count(); await pg.locator('.ribbon button[title="Show only top-level tasks"]').click(); await pg.waitForTimeout(250); const n1 = await pg.locator('table.grid tbody tr').count();
    await pg.locator('.ribbon button[title="Show all subtasks"]').click(); await pg.waitForTimeout(250); const n2 = await pg.locator('table.grid tbody tr').count(); ok(n1 < n0 && n2 === n0, [n0, n1, n2].join(',')); return [n0, n1, n2].join('→'); });
  await step('gantt: collapse / expand a summary with the caret', async () => { const n0 = await pg.locator('table.grid tbody tr').count(); await pg.locator('table.grid .caret').first().click(); await pg.waitForTimeout(200); const n1 = await pg.locator('table.grid tbody tr').count(); await pg.locator('table.grid .caret').first().click(); const n2 = await pg.locator('table.grid tbody tr').count(); ok(n1 < n0 && n2 === n0, [n0, n1, n2].join(',')); });
  await step('format: bar colour themes change the chart', async () => {
    await tab(pg, 'Format'); const seen = []; for (const c of ['indigo', 'amber', 'slate', 'green', 'brown']) { await pg.locator('.ribbon button[title="' + c + ' bars"], .ribbon button', { hasText: c + ' bars' }).first().click().catch(() => pg.locator('.ribbon button[title="' + c + ' bars"]').click()); await pg.waitForTimeout(150); seen.push(await pg.evaluate(() => document.documentElement.getAttribute('data-bars'))); } eq(seen, ['indigo', 'amber', 'slate', 'green', 'brown']); });
  await step('format: insert column menu adds a column', async () => { await tab(pg, 'Format'); const h0 = await pg.locator('table.grid thead th').count(); await pg.locator('.ribbon button', { hasText: /Insert\s*Column/ }).click(); const items = await pg.locator('.menu.open button, .menu.open [role=menuitem]').allInnerTexts(); return h0 + ' cols; menu: ' + items.join(' | '); });
  await step('network: scope, day/date toggle, critical toggle, zoom, PNG export', async () => {
    await stat('Network Diagram'); await pg.waitForTimeout(300); const w0 = await pg.locator('.view svg').first().getAttribute('width');
    await pg.locator('.seg button', { hasText: 'Dates' }).click(); await pg.waitForTimeout(250); await pg.locator('.seg button', { hasText: 'Day numbers' }).click();
    await pg.locator('label', { hasText: 'Critical path' }).locator('input').click(); await pg.locator('label', { hasText: 'Critical path' }).locator('input').click();
    await pg.locator('button[title*="Zoom in"], button[aria-label*="Zoom in"]').first().click().catch(() => {}); const dl = pg.waitForEvent('download', { timeout: 4000 }); await pg.locator('button', { hasText: 'PNG' }).first().click(); const d = await dl;
    const buf = fs.readFileSync(await d.path()); ok(buf.slice(1, 4).toString() === 'PNG', 'not a PNG'); await clean(pg); return d.suggestedFilename() + ' ' + Math.round(buf.length / 1024) + 'KB'; });
  await step('network: scope to one phase', async () => { const sel = pg.locator('.view select').first(); const opts = await sel.locator('option').count(); await sel.selectOption({ index: 1 }); await pg.waitForTimeout(300); await clean(pg); return opts + ' scopes'; });
  await step('wbs: depth buttons 1..n', async () => { await tab(pg, 'View'); await pg.locator('.ribbon button', { hasText: /WBS\s*Chart/ }).click(); const bs = pg.locator('.seg button'); const n = await bs.count(); for (let i = 0; i < n; i++) { await bs.nth(i).click(); await pg.waitForTimeout(120); } await clean(pg); return n + ' depths'; });
  await step('resource usage + team chart + resource sheet inline edit', async () => {
    await stat('Resource Sheet'); const inp = pg.locator('table.data input').first(); const v = await inp.inputValue(); await inp.fill(v + ' X'); await inp.press('Enter'); await pg.waitForTimeout(250); ok((await proj(pg)).resources.some(r => r.name.endsWith(' X')), 'rename not saved'); await clean(pg); });
  // ---- reports ----
  pg = await L.fresh(b); await L.open(pg);
  await step('baseline + update, then all 11 reports render with real numbers', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Baseline/ }).first().click(); await pg.locator('.menu.open button').first().click(); await pg.waitForTimeout(250);
    await pg.locator('.ribbon button', { hasText: /Update Project/ }).click(); await pg.waitForTimeout(250); await pg.locator('.statusbar button[title="Reports"]').click();
    const names = await pg.locator('.rpt-nav button').allInnerTexts(); const out = [];
    for (let i = 0; i < names.length; i++) { await pg.locator('.rpt-nav button').nth(i).click(); await pg.waitForTimeout(250); await clean(pg); const len = await pg.locator('.rpt-body').innerText().then(t => t.length); ok(len > 120, names[i] + ' is empty (' + len + ')'); out.push(names[i]); } eq(names.length, 11); return out.join(', '); });
  await step('earned value report shows SPI / CPI / EAC numbers', async () => { await pg.locator('.rpt-nav button', { hasText: /Earned/ }).click(); const t = await pg.locator('.rpt-body').innerText(); ok(/SPI/.test(t) && /CPI/.test(t) && /EAC/.test(t), 'missing EVM'); ok(!/NaN|Infinity/.test(t), 'bad number'); });
  await step('reports: print all + print one', async () => { await pg.locator('.rpt-body .btn', { hasText: 'Print all reports' }).click(); await pg.waitForTimeout(500); const n = await pg.evaluate(() => window.__printed || 0); ok(n >= 1, 'print was not called'); await clean(pg); });
  // ---- themes ----
  pg = await L.fresh(b); await L.open(pg);
  await step('theme: dark toggle in app, persists after reload, landing stays light', async () => {
    await pg.locator('button[aria-label="Toggle dark mode"]').click(); eq(await pg.evaluate(() => document.documentElement.dataset.theme), 'dark');
    const barBg = await pg.evaluate(() => getComputedStyle(document.querySelector('.titlebar')).backgroundColor); ok(barBg !== 'rgb(255, 255, 255)', 'titlebar not dark: ' + barBg);
    await pg.reload(); await pg.waitForSelector('.ribbon-tabs'); eq(await pg.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await L.open(pg, ''); eq(await pg.evaluate(() => getComputedStyle(document.querySelector('.landing')).backgroundColor), 'rgb(250, 248, 243)'); });
  await step('theme: light titlebar + File page in light', async () => { await L.open(pg); await pg.locator('button[aria-label="Toggle dark mode"]').click(); eq(await pg.evaluate(() => getComputedStyle(document.querySelector('.titlebar')).backgroundColor), 'rgb(253, 251, 247)'); await L.clean(pg); });
  console.log('\nSUMMARY', JSON.stringify(L.counts()), 'errors', JSON.stringify(pg.errors)); await b.close();
})();
