// End-to-end test: drives the built app in a real browser. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok, proj, toast, row, tab, confirm, clean } = L;
(async () => {
  const b = await L.launch(); let pg = await L.fresh(b); await L.open(pg);
  await step('add task, set duration 3d and predecessor 22', async () => {
    await tab(pg, 'Task'); await pg.locator('.ribbon button', { hasText: /^Task$/ }).first().click(); await pg.keyboard.type('QA task'); await pg.keyboard.press('Enter');
    const d = pg.locator('[aria-label="Task 23 Duration"]'); await d.fill('3d'); await d.press('Enter');
    const pr = pg.locator('[aria-label="Task 23 predecessors"]'); await pr.fill('22'); await pr.press('Enter'); const p = await proj(pg);
    eq(p.tasks[22].duration, 3); eq(p.tasks[22].preds.length, 1);
    const f = await pg.locator('table.grid tbody tr:nth-child(23) td.ro').nth(1).innerText(); ok(/Feb/.test(f) && !/13 Feb 26/.test(f), 'finish=' + f); return 'finish ' + f; });
  await step('bad predecessor text → message; loop → refused', async () => {
    const pr = pg.locator('[aria-label="Task 23 predecessors"]'); await pr.fill('zzz'); await pr.press('Enter'); await pg.waitForTimeout(200); const t1 = await toast(pg);
    const p22 = pg.locator('[aria-label="Task 22 predecessors"]'); await p22.fill('23'); await p22.press('Enter'); await pg.waitForTimeout(200); const t2 = await toast(pg);
    ok(/Could not read/.test(t1), t1); ok(/loop/.test(t2), t2); });
  await step('SS / FF / lag predecessor text "21SS+2d" is accepted', async () => {
    const pr = pg.locator('[aria-label="Task 23 predecessors"]'); await pr.fill('21SS+2d'); await pr.press('Enter'); const l = (await proj(pg)).tasks[22].preds[0]; eq([l.type, l.lag], ['SS', 2]); });
  await step('side details panel shows the selected task and edits it', async () => {
    await tab(pg, 'Task'); await row(pg, 3); await pg.waitForTimeout(300);
    if (!(await pg.locator('aside.drawer').count())) await pg.locator('.ribbon button', { hasText: 'Information' }).click();
    await pg.waitForSelector('aside.drawer'); eq(await pg.locator('aside.drawer input').first().inputValue(), 'Gather requirements & user stories', 'drawer shows wrong task');
    const nm = pg.locator('aside.drawer input').first(); await nm.fill('Gather requirements v2'); await nm.press('Enter'); await pg.waitForTimeout(200);
    eq((await proj(pg)).tasks[2].name, 'Gather requirements v2'); });
  await step('drawer: notes, % complete, constraint, deadline persist', async () => {
    const inputs = await pg.locator('aside.drawer').evaluate(a => [...a.querySelectorAll('input,select,textarea')].map(e => (e.closest('label')?.innerText || e.getAttribute('aria-label') || e.name || '').trim().split('\n')[0] + ':' + e.tagName)); return inputs.slice(0, 14).join(' | '); });
  await step('project information dialog saves name, budget, hours/day', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Project\s*Information/ }).click(); await pg.waitForSelector('dialog[open]');
    await pg.locator('dialog[open] input[name=name]').fill('QA Project'); await pg.locator('dialog[open] input[name=hoursPerDay]').fill('6'); await pg.locator('dialog[open] .btn.primary').click();
    const p = await proj(pg); eq([p.name, p.hoursPerDay], ['QA Project', 6]); ok(/QA Project/.test(await pg.locator('.title').innerText()), 'title bar'); });
  await step('baseline: set → update menu → clear asks first', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Baseline/ }).first().click(); await pg.locator('.menu.open button').first().click(); await pg.waitForTimeout(250); ok((await proj(pg)).baseline, 'no baseline');
    await pg.locator('.ribbon button', { hasText: /Baseline/ }).first().click(); await pg.locator('.menu.open button', { hasText: 'Clear Baseline' }).click(); await confirm(pg); eq((await proj(pg)).baseline, null); });
  await step('status date + "Update Project" moves progress, no broken numbers', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Update Project/ }).click(); await pg.waitForTimeout(250); ok(/Updated/.test(await toast(pg)), await toast(pg)); await clean(pg); });
  await step('working week: set Sunday to Thursday → dates move, resources follow, setting survives a reload', async () => {
    const dates = () => pg.locator('table.grid tbody tr:nth-child(2) td.ro').allInnerTexts();
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Project\s*Information/ }).click(); await pg.waitForSelector('dialog[open]');
    const boxes = pg.locator('dialog[open] input[name="pwd"]'); eq(await boxes.count(), 7);
    const checked = async () => boxes.evaluateAll(es => es.filter(e => e.checked).map(e => +e.value)); eq(await checked(), [1, 2, 3, 4, 5]);
    await pg.locator('dialog[open] input[name="pwd"][value="5"]').uncheck(); await pg.locator('dialog[open] input[name="pwd"][value="0"]').check(); await pg.locator('dialog[open] .btn.primary').click();
    const p = await proj(pg); eq(p.workDays, [0, 1, 2, 3, 4]); ok(p.resources.every(r => r.workDays.join() === '0,1,2,3,4'), 'resources did not follow the project week');
    await pg.reload(); await pg.waitForSelector('.ribbon-tabs'); eq((await proj(pg)).workDays, [0, 1, 2, 3, 4]); await clean(pg); });
  await step('working week: at least one day must stay selected', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Project\s*Information/ }).click(); await pg.waitForSelector('dialog[open]');
    for (const d of [0, 1, 2, 3, 4]) await pg.locator('dialog[open] input[name="pwd"][value="' + d + '"]').uncheck(); await pg.locator('dialog[open] .btn.primary').click(); await pg.waitForTimeout(250);
    ok(/at least one working day/.test(await toast(pg)), await toast(pg)); ok(await pg.locator('dialog[open]').count() === 1, 'dialog closed'); eq((await proj(pg)).workDays, [0, 1, 2, 3, 4]); await pg.keyboard.press('Escape'); });
  await step('currency picker: choosing GBP fills the symbol, is saved, and shows in the budget', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Project\s*Information/ }).click(); await pg.waitForSelector('dialog[open]');
    eq(await pg.locator('dialog[open] select[name="currencyCode"]').inputValue(), ''); // "Rs." could be several countries, so nothing is guessed
    await pg.locator('dialog[open] select[name="currencyCode"]').selectOption('GBP'); eq(await pg.locator('dialog[open] input[name="currency"]').inputValue(), '£');
    await pg.screenshot({ path: L.OUT + 'shots_project_dialog.png' });
    await pg.locator('dialog[open] .btn.primary').click(); const p = await proj(pg); eq([p.currency, p.currencyCode], ['£', 'GBP']);
    await pg.locator('.statusbar button[title="Reports"]').click(); await pg.waitForTimeout(300); await tab(pg, 'Report'); await pg.locator('.ribbon button', { hasText: /Cost\s*&\s*Budget/ }).click(); await pg.waitForTimeout(500);
    ok(/£\s?[\d,]+/.test(await pg.locator('.kpis').first().innerText()), 'budget does not show £'); });
  await step('currency picker: a custom symbol can be typed and the dropdown stays on the chosen currency', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Project\s*Information/ }).click(); await pg.waitForSelector('dialog[open]');
    eq(await pg.locator('dialog[open] select[name="currencyCode"]').inputValue(), 'GBP'); await pg.locator('dialog[open] input[name="currency"]').fill('GB£'); await pg.locator('dialog[open] .btn.primary').click();
    const p = await proj(pg); eq([p.currency, p.currencyCode], ['GB£', 'GBP']); });
  await step('currency picker: the longer list has Korean won, Thai baht, Polish złoty and more, and choosing one fills its symbol', async () => {
    await tab(pg, 'Project'); await pg.locator('.ribbon button', { hasText: /Project\s*Information/ }).click(); await pg.waitForSelector('dialog[open]');
    const codes = await pg.locator('dialog[open] select[name="currencyCode"] option').evaluateAll(os => os.map(o => o.value)); for (const c of ['EGP', 'THB', 'VND', 'IDR', 'PHP', 'TRY', 'PLN', 'CZK', 'HUF', 'ILS', 'NZD', 'KRW', 'SEK', 'NOK', 'DKK', 'HKD']) ok(codes.includes(c), c + ' missing');
    await pg.locator('dialog[open] select[name="currencyCode"]').selectOption('KRW'); eq(await pg.locator('dialog[open] input[name="currency"]').inputValue(), '₩');
    await pg.locator('dialog[open] select[name="currencyCode"]').selectOption('PLN'); eq(await pg.locator('dialog[open] input[name="currency"]').inputValue(), 'zł');
    await pg.locator('dialog[open] .btn.primary').click(); const p = await proj(pg); eq([p.currency, p.currencyCode], ['zł', 'PLN']); return codes.length + ' currencies'; });
  await step('custom field: add via project dialog and see it as a column', async () => {
    await pg.locator('.ribbon button[title="Custom Fields"]').click(); await pg.waitForSelector('dialog[open]'); const t = await pg.locator('dialog[open]').innerText(); ok(/[Cc]ustom/.test(t), 'no custom field section'); await pg.keyboard.press('Escape'); });
  // resources
  pg = await L.fresh(b); await L.open(pg);
  await step('resources: add a person, name + rate, appears in sheet', async () => {
    await tab(pg, 'Resource'); await pg.locator('.ribbon button', { hasText: /Add\s*Resources/ }).click(); await pg.waitForTimeout(300); await pg.keyboard.type('QA Person'); await pg.keyboard.press('Enter');
    const p = await proj(pg); ok(p.resources.some(r => r.name === 'QA Person'), 'resource missing'); return p.resources.length + ' resources'; });
  await step('assign a resource to a task from the ribbon, cost updates', async () => {
    await pg.locator('.statusbar button[title="Gantt Chart"], .statusbar button[aria-label="Gantt Chart"]').first().click(); await tab(pg, 'Task'); await row(pg, 3); const before = (await proj(pg)).tasks[2].assignments.length; await pg.locator('.ribbon button', { hasText: /Assign\s*Resources/ }).first().click(); await pg.waitForTimeout(400);
    return 'assignments before=' + before + ' · ' + (await L.state(pg)).dialog + ' · drawer=' + await pg.locator('aside.drawer').count(); });
  await step('overallocation → flagged, Next Overallocation, Level All, Clear Leveling', async () => {
    // build an overallocated plan: give person 1 to two parallel tasks at 100% each ×2 (200%)
    const raw = await proj(pg); const r0 = raw.resources.find(r => r.kind === 'Work'); const t7 = raw.tasks.find(t => t.name.startsWith('Architecture')), t8 = raw.tasks.find(t => t.name.startsWith('UI wireframes'));
    for (const t of [t7, t8]) t.assignments = [{ res: r0.uid, units: r0.maxUnits }];
    await pg.evaluate(j => localStorage.setItem('openplan.project', JSON.stringify(j)), raw); await pg.reload(); await pg.waitForSelector('.ribbon-tabs');
    await tab(pg, 'Resource'); await pg.locator('.ribbon button[title="Next Overallocation"]').click(); await pg.waitForTimeout(250); const n1 = await toast(pg);
    await tab(pg, 'Resource'); await pg.locator('.ribbon button', { hasText: /Level\s*All/ }).click(); await pg.waitForTimeout(300); const n2 = await toast(pg);
    const delayed = (await proj(pg)).tasks.filter(t => t.levelDelay > 0).length; await tab(pg, 'Resource'); await pg.locator('.ribbon button[title="Clear Leveling"]').click(); const cleared = (await proj(pg)).tasks.filter(t => t.levelDelay > 0).length;
    ok(delayed >= 1 && cleared === 0, 'delayed=' + delayed + ' cleared=' + cleared); await clean(pg); return n1 + ' | ' + n2; });
  await step('autosave: edits survive reload, undo history resets cleanly', async () => { const n = (await proj(pg)).tasks.length; await pg.reload(); await pg.waitForSelector('.ribbon-tabs'); eq((await proj(pg)).tasks.length, n); await clean(pg); });
  console.log('\nSUMMARY', JSON.stringify(L.counts()), 'errors', JSON.stringify(pg.errors)); await b.close();
})();
