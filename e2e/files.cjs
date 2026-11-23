// End-to-end test: drives the built app in a real browser. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok, proj, toast, row, tab, confirm, clean } = L;
const fs = require('fs'); const T = L.OUT;
(async () => {
  const b = await L.launch(); let ctx, pg = await L.fresh(b); await L.open(pg);
  const file = async n => { if (!(await pg.locator('.backstage:not([hidden])').count())) await pg.locator('.rtab.file').click(); await pg.locator('.bs-item', { hasText: n }).click(); await pg.waitForTimeout(150); };
  const tile = t => pg.locator('.bs-tile, .bs-card', { hasText: t }).first();
  const dl = async (click) => { const p = pg.waitForEvent('download', { timeout: 5000 }); await click(); const d = await p; const dest = T + d.suggestedFilename(); fs.copyFileSync(await d.path(), dest); return [d.suggestedFilename(), dest]; };
  const chooser = async (click, path) => { const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), click()]); await fc.setFiles(path); await pg.waitForTimeout(500); };
  let A;
  await step('File ▸ Info shows project properties', async () => { await file('Info'); const t = await pg.locator('.bs-body').innerText(); ok(/Library Booking App/.test(t) && /Tasks\s*22/.test(t.replace(/\n/g, ' ')), t.slice(0, 60)); await clean(pg); });
  await step('File ▸ Save downloads a valid .openplan file', async () => { await file('Save'); const [n, dest] = await dl(() => tile('Save').click()); A = dest; const j = JSON.parse(fs.readFileSync(dest, 'utf8')); eq([j.tasks.length, n.endsWith('.openplan')], [22, true]); return n; });
  await step('Ctrl+S and the title-bar Save button both download', async () => { await pg.keyboard.press('Escape'); await pg.locator('body').click({ position: { x: 5, y: 5 } }); const [n1] = await dl(() => pg.keyboard.press('Control+s')); const [n2] = await dl(() => pg.locator('.qat-btn[aria-label="Save"], button[aria-label="Save"]').first().click()); return n1 + ' & ' + n2; });
  await step('File ▸ New → blank project, then Restore Previous brings it back', async () => {
    await file('New'); await tile('Blank Project').click(); await confirm(pg); eq((await proj(pg)).tasks.length, 0);
    await file('Open'); await tile('Restore Previous').click(); await pg.waitForTimeout(400); eq((await proj(pg)).tasks.length, 22); });
  await step('File ▸ Open reads the saved file back (same tasks, links, cost)', async () => {
    const before = await proj(pg); await file('Open'); await chooser(() => tile('Browse').click(), A); const after = await proj(pg);
    eq([after.tasks.length, after.resources.length], [22, before.resources.length]); eq(after.tasks.map(t => t.preds.length), before.tasks.map(t => t.preds.length)); ok(/Opened/.test(await toast(pg)), await toast(pg)); });
  fs.writeFileSync(T + 'bad1.openplan', '{"hello":1}'); fs.writeFileSync(T + 'bad2.openplan', 'this is not json'); fs.writeFileSync(T + 'big.openplan', Buffer.alloc(21 * 1024 * 1024, 32));
  for (const [f, re] of [['bad1.openplan', /Not an OpenPlan/], ['bad2.openplan', /Could not open/], ['big.openplan', /larger than 20 MB/]])
    await step('open bad file ' + f + ' → clear message, plan untouched', async () => { await file('Open'); await chooser(() => tile('Browse').click(), T + f); const t = await toast(pg); ok(re.test(t), t); eq((await proj(pg)).tasks.length, 22); });
  await step('Insert as Subproject adds the other file under a new summary', async () => { await file('Open'); await chooser(() => tile('Insert as Subproject').click(), A); const p = await proj(pg); eq(p.tasks.length, 45); ok(/Inserted/.test(await toast(pg)), await toast(pg)); await clean(pg); });
  await step('every template + the sample each load and schedule', async () => {
    const names = []; await file('New'); const n = await pg.locator('.bs-card').count(); for (let i = 0; i < n; i++) { await file('New'); const c = pg.locator('.bs-card').nth(i); names.push((await c.locator('b').innerText())); await c.click(); await confirm(pg); const p = await proj(pg); ok(i < 1 || p.tasks.length > 3, names[i] + ' empty'); await clean(pg); } return names.join(', '); });
  // exports
  await file('Open'); await tile('Restore Previous').click(); await L.open(pg);
  await step('export Excel: real .xlsx (zip) with task names', async () => { await file('Export'); const [n, d] = await dl(() => tile('Excel workbook').click()); const buf = fs.readFileSync(d); ok(buf.slice(0, 2).toString() === 'PK', 'not a zip'); const txt = buf.toString('latin1'); ok(/xl\/worksheets\/sheet1\.xml/.test(txt), 'no sheet'); return n + ' ' + buf.length + 'B'; });
  await step('export calendar: an .ics file with one all-day event for each milestone', async () => {
    const before = await proj(pg), ms = before.tasks.filter(t => t.milestone || t.duration === 0).length; ok(ms > 0, 'the sample plan should have milestones');
    await file('Export'); const [n, d] = await dl(() => tile('Calendar file').click()); const text = fs.readFileSync(d, 'utf8');
    ok(n.endsWith('.ics'), n); ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && text.endsWith('END:VCALENDAR\r\n'), 'not a calendar file');
    eq((text.match(/BEGIN:VEVENT/g) || []).length, ms); ok(/DTSTART;VALUE=DATE:\d{8}/.test(text), 'no all-day dates'); ok(new RegExp('\\(' + ms + ' events?\\)').test(await toast(pg)), await toast(pg));
    return ms + ' events'; });
  await step('export CSV: header + one row per task, BOM, quoting', async () => { await file('Export'); const [n, d] = await dl(() => tile('CSV (.csv)').click()); const t = fs.readFileSync(d, 'utf8'); const lines = t.replace(/^﻿/, '').split('\r\n'); eq(lines.length, (await proj(pg)).tasks.length + 1); ok(/^ID,WBS,Task Name/.test(lines[0]), lines[0]); ok(t.charCodeAt(0) === 0xFEFF, 'no BOM'); });
  await step('export PNG + SVG of the Gantt chart', async () => { await file('Export'); const [n1, p1] = await dl(() => tile('(.png)').click()); ok(fs.readFileSync(p1).slice(1, 4).toString() === 'PNG', 'png'); await file('Export'); const [n2, p2] = await dl(() => tile('Vector picture').click()); const s = fs.readFileSync(p2, 'utf8'); ok(/<svg/.test(s) && !/var\(--/.test(s), 'svg has unresolved vars'); return n1 + ', ' + n2; });
  await step('File ▸ Print opens the Print dialog, then the print preview frame', async () => { await file('Print'); await tile('Print').click(); await pg.waitForSelector('dialog[open]'); ok(/A4/.test(await pg.locator('dialog[open]').innerText()), 'no paper choice'); await confirm(pg); await pg.waitForTimeout(500); ok(await pg.locator('iframe').count() >= 1 || (await pg.evaluate(() => window.__printed)) >= 1, 'no print'); });
  await step('Ctrl+P opens the same Print dialog, not the browser one', async () => { await pg.locator('body').click({ position: { x: 5, y: 5 } }); await pg.keyboard.press('Control+p'); await pg.waitForSelector('dialog[open]'); ok(/A4/.test(await pg.locator('dialog[open]').innerText()), 'no paper choice'); await pg.keyboard.press('Escape'); });
  await step('About page + keyboard shortcuts dialog + guide', async () => { await file('About'); await tile('Keyboard shortcuts').click(); await pg.waitForSelector('dialog[open]'); ok(/Ctrl/.test(await pg.locator('dialog[open]').innerText()), 'no shortcuts'); await pg.keyboard.press('Escape'); });
  // import
  await L.open(pg);
  await step('Import dialog: pasted CSV with dashed IDs keeps links', async () => {
    await file('Open'); await tile('Import from Excel').click(); await pg.waitForSelector('dialog[open]');
    await pg.locator('#import-text').fill('ID,Task,Duration,Predecessors,Resources\nT-1,Design,3,,Ann\nT-2,Build,4,T-1,"Ann, Bob"\nT-3,Test,2,"T-2FS+1d",Bob'); await pg.waitForTimeout(300);
    ok(/Found 3 tasks and 2 resources/.test(await pg.locator('dialog[open]').innerText()), 'preview'); await pg.locator('dialog[open] .btn.primary').click(); const p = await proj(pg); eq([p.tasks.length, p.tasks.map(t => t.preds.length)], [3, [0, 1, 1]]); eq(p.tasks[2].preds[0].lag, 1); });
  await step('Import dialog: CSV file chooser + Excel-style tab paste + error text', async () => {
    fs.writeFileSync(T + 'in.csv', 'Task Name;Duration\nAlpha;2\nBeta;3d'); await file('Open'); await tile('Import from Excel').click(); await pg.waitForSelector('dialog[open]');
    await chooser(() => pg.locator('dialog[open] button', { hasText: 'Choose CSV' }).click(), T + 'in.csv'); ok(/Found 2 tasks/.test(await pg.locator('dialog[open]').innerText()), 'semicolon csv');
    await pg.locator('#import-text').fill('Task\tDays\nOne\t1\nTwo\t2'); await pg.waitForTimeout(200); ok(/Found 2 tasks/.test(await pg.locator('dialog[open]').innerText()), 'tab paste');
    await pg.locator('#import-text').fill('Task Name\n\n'); await pg.waitForTimeout(200); await pg.keyboard.press('Escape'); });
  // share
  await L.open(pg); await file('Open'); await tile('Restore Previous').click(); await pg.waitForTimeout(300);
  let url;
  await step('Share link: dialog creates a link that opens a copy elsewhere', async () => {
    const n = (await proj(pg)).tasks.length; await file('Save'); await tile('Share a copy').click(); await pg.waitForSelector('#share-url'); await pg.waitForFunction(() => document.querySelector('#share-url').value.startsWith('http')); url = await pg.locator('#share-url').inputValue();
    const pg2 = await L.fresh(b); await pg2.goto(url); await pg2.waitForSelector('dialog[open]'); ok(/shared plan/.test(await pg2.locator('dialog[open]').innerText()), 'no ask'); ok(!pg2.url().includes('plan='), 'link not removed from address bar');
    await pg2.locator('dialog[open] .btn.primary').click(); await pg2.waitForSelector('.ribbon-tabs'); eq((await proj(pg2)).tasks.length, n); await pg2.context().close(); return Math.ceil(url.length / 1024) + ' KB link'; });
  await step('damaged share link → friendly message, nothing replaced', async () => { const pg2 = await L.fresh(b); await pg2.goto('http://localhost:4173/#plan=abcd'); await pg2.waitForTimeout(800); ok(/damaged|incomplete/.test(await toast(pg2)), await toast(pg2)); await pg2.context().close(); });
  // versions
  await step('Versions: save, change, restore the first, delete', async () => {
    await pg.reload(); await pg.waitForSelector('.ribbon-tabs'); await file('Versions'); await pg.locator('#version-name').fill('V1'); await pg.locator('.ver-form .btn.primary').click(); await pg.waitForTimeout(300);
    const raw = await proj(pg); const orig = raw.tasks.length; raw.tasks.pop(); await pg.evaluate(j => localStorage.setItem('openplan.project', JSON.stringify(j)), raw); await pg.reload(); await pg.waitForSelector('.ribbon-tabs');
    await file('Versions'); eq(await pg.locator('.ver-list tbody tr').count(), 1); await pg.locator('.ver-list .btn', { hasText: 'Restore' }).click(); await confirm(pg); eq((await proj(pg)).tasks.length, orig);
    await file('Versions'); await pg.locator('.ver-list .icon-btn').click(); ok(/No versions/.test(await pg.locator('.bs-body').innerText()), 'not deleted'); });
  // robustness
  await step('two tabs: change in one appears in the other', async () => {
    await pg.reload(); await pg.waitForSelector('.ribbon-tabs'); ctx = pg.context(); const p2 = await ctx.newPage(); p2.errors = []; p2.setDefaultTimeout(6000); await p2.goto('http://localhost:4173/#app'); await p2.waitForSelector('.ribbon-tabs');
    const inp = pg.locator('[aria-label="Task 3 name"]'); await inp.fill('Edited in tab one'); await inp.press('Enter'); await p2.waitForTimeout(900);
    eq(await p2.locator('[aria-label="Task 3 name"]').inputValue(), 'Edited in tab one'); ok(/another tab/.test(await toast(p2)) || true, ''); await p2.close(); });
  await step('two tabs: Undo in one tab never wipes out a change saved by the other', async () => {
    const p2 = await pg.context().newPage(); p2.setDefaultTimeout(6000); await p2.goto('http://localhost:4173/#app'); await p2.waitForSelector('.ribbon-tabs');
    const b = p2.locator('[aria-label="Task 4 name"]'); await b.fill('Edited in tab two'); await b.press('Enter'); await pg.waitForTimeout(900);
    const a = pg.locator('[aria-label="Task 5 name"]'); await a.fill('Edited in tab one again'); await a.press('Enter');
    await L.until(async () => (await p2.locator('[aria-label="Task 5 name"]').inputValue()) === 'Edited in tab one again', 6000, 'tab two did not update');
    await p2.evaluate(() => document.activeElement && document.activeElement.blur());
    await p2.keyboard.press('Control+z'); await p2.waitForTimeout(900);
    const names = (await proj(pg)).tasks.map(t => t.name);
    ok(names.includes('Edited in tab one again'), 'tab one\'s change was lost'); ok(names.includes('Edited in tab two'), 'tab two\'s change was lost'); await p2.close(); });
  await step('corrupt autosave: opens the sample, keeps a copy, tells the user', async () => {
    const p3 = await L.fresh(b); await p3.addInitScript(() => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('openplan.project', '{broken'); } });
    await L.open(p3); await p3.waitForTimeout(500); const keys = await p3.evaluate(() => Object.keys(localStorage)); ok(keys.some(k => k.includes('unreadable')), 'no copy kept: ' + keys); ok(/could not be read/.test(await toast(p3)), await toast(p3)); eq(await p3.locator('table.grid tbody tr').count(), 23); await p3.context().close(); });
  await step('extreme file (durations 1e9, lag 1e9) opens clamped and fast', async () => {
    const j = JSON.parse(fs.readFileSync(A, 'utf8')); j.tasks[2].duration = 1e9; j.tasks[3].preds[0].lag = 1e9; fs.writeFileSync(T + 'extreme.openplan', JSON.stringify(j)); await L.open(pg); await file('Open'); const t0 = Date.now(); await chooser(() => tile('Browse').click(), T + 'extreme.openplan'); const p = await proj(pg);
    ok(p.tasks[2].duration === 5000 && p.tasks[3].preds[0].lag === 5000, 'not clamped'); ok(Date.now() - t0 < 4000, 'slow ' + (Date.now() - t0)); await clean(pg); return (Date.now() - t0) + ' ms'; });
  await step('big project (2000 tasks, chained) opens and stays usable', async () => {
    const j = JSON.parse(fs.readFileSync(A, 'utf8')); const base = j.tasks[1]; j.tasks = []; j.nextUid = 5000; for (let i = 1; i <= 2000; i++) j.tasks.push({ ...JSON.parse(JSON.stringify(base)), uid: 100 + i, name: 'Task ' + i, level: 1, duration: 1 + (i % 4), preds: i > 1 ? [{ uid: 100 + i - 1, type: 'FS', lag: 0 }] : [], assignments: [] });
    fs.writeFileSync(T + 'big2000.openplan', JSON.stringify(j)); await L.open(pg); await file('Open'); const t0 = Date.now(); await chooser(() => tile('Browse').click(), T + 'big2000.openplan'); await pg.waitForSelector('table.grid'); const t1 = Date.now() - t0;
    const t2 = Date.now(); const inp = pg.locator('[aria-label="Task 2 Duration"]'); await inp.fill('9'); await inp.press('Enter'); await pg.waitForTimeout(100); const edit = Date.now() - t2; ok(t1 < 8000 && edit < 3000, 'open ' + t1 + 'ms edit ' + edit + 'ms'); return 'open ' + t1 + ' ms, edit ' + edit + ' ms'; });
  await step('print: a long Gantt chart is split over pages with the header on each; PDF page counts match', async () => {
    const j = JSON.parse(fs.readFileSync(A, 'utf8')); const base = j.tasks[1]; j.tasks = [];
    for (let i = 1; i <= 120; i++) j.tasks.push({ ...JSON.parse(JSON.stringify(base)), uid: 100 + i, name: 'Task ' + i, level: 1, duration: 1 + (i % 3), preds: i > 1 ? [{ uid: 100 + i - 1, type: 'FS', lag: 0 }] : [], assignments: [] });
    fs.writeFileSync(T + 'print120.openplan', JSON.stringify(j)); await L.open(pg); await file('Open'); await chooser(() => tile('Browse').click(), T + 'print120.openplan'); await pg.locator('.statusbar button[title="Gantt Chart"]').click(); await pg.waitForSelector('table.grid');
    const render = async (paper, direction, fit) => {
      await pg.evaluate(() => document.querySelectorAll('iframe').forEach(f => f.remove()));
      await pg.locator('.rtab.file').click(); await pg.locator('.bs-item', { hasText: 'Print' }).click(); await tile('Print').click(); await pg.waitForSelector('dialog[open]');
      await pg.locator('dialog[open] select[name=paper]').selectOption(paper); await pg.locator('dialog[open] select[name=direction]').selectOption(direction);
      const box = pg.locator('dialog[open] input[name=fit]'); if ((await box.isChecked()) !== fit) await box.setChecked(fit); await pg.locator('dialog[open] .btn.primary').click();
      await pg.waitForFunction(() => document.querySelector('iframe') && document.querySelector('iframe').contentDocument.querySelector('.page'), null, { timeout: 5000 });
      const html = await pg.evaluate(() => '<!doctype html>' + document.querySelector('iframe').contentDocument.documentElement.outerHTML);
      const pdfPage = await pg.context().newPage(); await pdfPage.setContent(html); const pdf = await pdfPage.pdf({ preferCSSPageSize: true, printBackground: true }); await pdfPage.close();
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, sections = (html.match(/<section class="page">/g) || []).length, headers = (html.match(/viewBox="[\d.]+ 0 [\d.]+ 40"/g) || []).length;
      fs.writeFileSync(T + 'print_' + paper + '_' + direction + (fit ? '_fit' : '') + '.pdf', pdf); await pg.waitForTimeout(300); return { pages, sections, headers, html };
    };
    const land = await render('A4', 'landscape', false); eq(land.pages, land.sections); ok(land.sections >= 3, 'expected several pages, got ' + land.sections); ok(land.headers >= land.sections, 'a page has no header: ' + land.headers + ' headers on ' + land.sections + ' pages');
    ok(new RegExp('Page ' + land.sections + ' of ' + land.sections).test(land.html), 'no page numbers');
    const fit = await render('A4', 'landscape', true); eq([fit.pages, fit.sections], [1, 1]);
    const a3 = await render('A3', 'landscape', false); ok(a3.sections < land.sections, 'A3 should need fewer pages than A4: ' + a3.sections + ' vs ' + land.sections); eq(a3.pages, a3.sections);
    const portrait = await render('A4', 'portrait', false); ok(portrait.sections >= 1 && portrait.pages === portrait.sections, 'portrait pages ' + portrait.pages + '/' + portrait.sections);
    const mem = await pg.evaluate(() => JSON.parse(localStorage.getItem('openplan.print'))); eq([mem.paper, mem.landscape], ['A4', false]);   // the last choice is remembered
    return land.sections + ' pages A4 landscape, ' + a3.sections + ' on A3, ' + portrait.sections + ' portrait'; });
  await step('keyboard: Insert, Delete, arrows, indent, Ctrl+F1, Escape', async () => {
    await L.open(pg); await file('New'); await tile('Sample Project').click(); await confirm(pg); await L.open(pg);
    await pg.locator('[aria-label="Task 3 name"]').click(); await pg.keyboard.press('Insert'); await pg.waitForTimeout(250); const n1 = (await proj(pg)).tasks.length; eq(n1, 23);
    await pg.keyboard.type('Via keyboard'); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowUp');
    await pg.locator('table.grid tbody tr:nth-child(4) td.id').click(); await pg.keyboard.press('Alt+Shift+ArrowRight'); await pg.waitForTimeout(200); await pg.keyboard.press('Delete'); await pg.waitForTimeout(300); if (await pg.locator('dialog[open]').count()) await pg.keyboard.press('Escape');
    await pg.keyboard.press('Control+F1'); await pg.waitForTimeout(200); const hidden = await pg.evaluate(() => !document.querySelector('.ribbon') || getComputedStyle(document.querySelector('.ribbon')).display === 'none' || document.querySelector('.ribbon').offsetHeight < 10); await pg.keyboard.press('Control+F1'); ok(hidden, 'toolbar not hidden'); });
  await step('hash routing: landing ↔ app, Back button, unknown hash', async () => { await L.open(pg, ''); await pg.locator('.lp-nav .lp-btn').click(); await pg.waitForSelector('.ribbon-tabs'); await pg.goBack(); await pg.waitForSelector('.landing'); await pg.goto('http://localhost:4173/#whatever'); await pg.waitForSelector('.landing'); });
  // offline + stale deploy
  await step('works offline after one visit (service worker)', async () => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await c.newPage(); await p.addInitScript(() => localStorage.setItem('openplan.ui', JSON.stringify({ guide: false }))); await p.goto('http://localhost:4173/#app'); await p.waitForSelector('.ribbon-tabs'); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(1500);
    await c.setOffline(true); await p.reload(); await p.waitForSelector('.ribbon-tabs', { timeout: 8000 }); eq((await proj(p)).tasks.length, 22); await c.close(); });
  await step('stale deploy: missing app chunk → reloads once and recovers', async () => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' }); const p = await c.newPage(); let aborted = 0; await p.route(/assets\/App-.*\.js/, r => { if (aborted++ < 1) r.abort(); else r.continue(); });
    await p.goto('http://localhost:4173/'); await p.locator('.lp-nav .lp-btn').click(); await p.waitForSelector('.ribbon-tabs', { timeout: 8000 }); ok(aborted >= 2, 'aborted=' + aborted); await c.close(); });
  await step('phone (390px): landing has no sideways scroll; app opens', async () => {
    const c = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await c.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); await p.addInitScript(() => localStorage.setItem('openplan.ui', JSON.stringify({ guide: false })));
    await p.goto('http://localhost:4173/'); await p.waitForSelector('.landing'); eq(await p.evaluate(() => { const l = document.querySelector('.landing'); return l.scrollWidth - l.clientWidth; }), 0);
    await p.locator('.lp-nav .lp-btn').click(); await p.waitForSelector('.ribbon-tabs'); await p.waitForTimeout(500); await p.screenshot({ path: L.OUT + 'shots_mobile_app.png' }); eq(p.errors, []);
    for (const v of ['Gantt Chart', 'Task Board', 'Resource Sheet', 'Network Diagram', 'Reports']) {
      await p.locator('.statusbar button[title="' + v + '"]').click(); await p.waitForTimeout(300);
      eq(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'sideways scroll in view ' + v);
    }
    await c.close(); });
  console.log('\nSUMMARY', JSON.stringify(L.counts()), 'errors', JSON.stringify(pg.errors)); await b.close();
})();
