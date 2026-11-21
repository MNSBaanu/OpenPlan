// End-to-end test: drives the built app in a real browser. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok, proj, toast, confirm, clean } = L; const fs = require('fs'); const T = L.OUT;
const task = (uid, name, lvl, x = '') => `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><OutlineLevel>${lvl}</OutlineLevel>${x}</Task>`;
const dur = h => `<Duration>PT${h}H0M0S</Duration>`;
const link = (uid, type, lag = 0) => `<PredecessorLink><PredecessorUID>${uid}</PredecessorUID><Type>${type}</Type><LinkLag>${lag}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`;
const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>site.xml</Name><Title>Website Launch</Title><Company>Acme</Company><CurrencySymbol>$</CurrencySymbol><StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay><CalendarUID>1</CalendarUID>
<Calendars><Calendar><UID>1</UID><IsBaseCalendar>1</IsBaseCalendar><Exceptions><Exception><TimePeriod><FromDate>2026-04-03T00:00:00</FromDate><ToDate>2026-04-03T23:59:00</ToDate></TimePeriod><DayWorking>0</DayWorking></Exception></Exceptions></Calendar></Calendars>
<Tasks>${task(0, 'Website Launch', 0, '<Summary>1</Summary>')}${task(1, 'Plan', 1, '<Summary>1</Summary>')}${task(2, 'Write brief', 2, dur(16) + '<PercentComplete>100</PercentComplete>')}${task(3, 'Approve brief', 2, '<Milestone>1</Milestone>' + dur(0) + link(2, 1))}${task(4, 'Build', 1, '<Summary>1</Summary>')}${task(5, 'Design pages', 2, dur(32) + link(3, 1, 4800))}${task(6, 'Write copy', 2, dur(24) + link(3, 3))}${task(7, 'Launch', 1, dur(8) + link(5, 1) + link(6, 0, -4800) + link(99, 1))}</Tasks>
<Resources><Resource><UID>1</UID><Name>Ana Silva</Name><Type>1</Type><MaxUnits>1</MaxUnits><StandardRate>40</StandardRate><StandardRateFormat>2</StandardRateFormat></Resource></Resources>
<Assignments><Assignment><UID>1</UID><TaskUID>5</TaskUID><ResourceUID>1</ResourceUID><Units>1</Units></Assignment></Assignments></Project>`;
fs.writeFileSync(T + 'site.xml', xml); fs.writeFileSync(T + 'bad.xml', '<Project><Name>nope</Name></Project>'); fs.writeFileSync(T + 'garbage.xml', 'this is not xml');
(async () => {
  const b = await L.launch(); let pg = await L.fresh(b); await L.open(pg);
  const file = async n => { if (!(await pg.locator('.backstage:not([hidden])').count())) await pg.locator('.rtab.file').click(); await pg.locator('.bs-item', { hasText: n }).click(); await pg.waitForTimeout(150); };
  const tile = t => pg.locator('.bs-tile', { hasText: t }).first();
  const chooser = async (click, path) => { const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), click()]); await fc.setFiles(path); await pg.waitForTimeout(600); };
  await step('File ▸ Open shows the Microsoft Project XML tile', async () => { await file('Open'); ok(await tile('Microsoft Project XML').count() === 1, 'tile missing'); ok(/Save As/.test(await tile('Microsoft Project XML').innerText()), 'help text'); });
  await step('import the XML: plan replaced, links/lag/resources/holiday carried over', async () => {
    await chooser(() => tile('Microsoft Project XML').click(), T + 'site.xml'); const p = await proj(pg);
    eq(p.tasks.map(t => t.name), ['Plan', 'Write brief', 'Approve brief', 'Build', 'Design pages', 'Write copy', 'Launch']); eq(p.name, 'Website Launch'); eq(p.holidays, ['2026-04-03']); eq(p.resources.length, 1);
    const idx = Object.fromEntries(p.tasks.map(t => [t.uid, t.name])); const dp = p.tasks.find(t => t.name === 'Design pages'); eq([idx[dp.preds[0].uid], dp.preds[0].lag], ['Approve brief', 1]); eq(dp.assignments[0].units, 100);
    const t = await toast(pg); ok(/Imported site\.xml: 7 tasks, 1 resources/.test(t) && /1 link/.test(t), t); return t.slice(0, 90); });
  await step('the imported plan is scheduled and drawn: no broken numbers, finish date is real', async () => {
    await pg.locator('.rtab.file').click().catch(() => {}); await pg.keyboard.press('Escape'); await L.open(pg); await clean(pg);
    const fin = await pg.locator('table.grid tbody tr:nth-child(7) td.ro').nth(1).innerText(); ok(/\d{1,2} \w{3} \d{2}/.test(fin), 'finish=' + fin); return 'Launch finishes ' + fin; });
  await step('Restore Previous brings the earlier plan back', async () => { await file('Open'); await tile('Restore Previous').click(); await pg.waitForTimeout(400); eq((await proj(pg)).tasks.length, 22); });
  await step('Browse also opens an .xml file', async () => { await file('Open'); await chooser(() => tile('Browse').click(), T + 'site.xml'); eq((await proj(pg)).tasks.length, 7); ok(/Imported/.test(await toast(pg)), await toast(pg)); });
  await step('a Microsoft Project XML file can be inserted as a subproject', async () => { await file('Open'); await tile('Restore Previous').click(); await pg.waitForTimeout(300); await file('Open'); await chooser(() => tile('Insert as Subproject').click(), T + 'site.xml'); eq((await proj(pg)).tasks.length, 22 + 7 + 1); });
  await step('wrong XML and garbage are refused with a clear message, plan untouched', async () => {
    const n = (await proj(pg)).tasks.length;
    for (const f of ['bad.xml', 'garbage.xml']) { await file('Open'); await chooser(() => tile('Microsoft Project XML').click(), T + f); ok(/Microsoft Project/.test(await toast(pg)), f + ': ' + await toast(pg)); eq((await proj(pg)).tasks.length, n); } });
  await step('an imported plan saves as .openplan and reopens the same', async () => {
    await file('Open'); await chooser(() => tile('Microsoft Project XML').click(), T + 'site.xml'); await file('Save');
    const dl = pg.waitForEvent('download', { timeout: 5000 }); await pg.locator('.bs-tile', { hasText: /^Save\b/ }).first().click(); const d = await dl; const copy = T + 'roundtrip.openplan'; fs.copyFileSync(await d.path(), copy);
    const saved = JSON.parse(fs.readFileSync(copy, 'utf8')); eq(saved.tasks.length, 7); await file('Open'); await tile('Restore Previous').click(); await file('Open'); await chooser(() => tile('Browse').click(), copy); eq((await proj(pg)).tasks.length, 7); });
  await step('File ▸ Export ▸ Microsoft Project XML downloads a file that imports back the same', async () => {
    const before = await proj(pg); await file('Export');
    const dl = pg.waitForEvent('download', { timeout: 5000 }); await tile('Microsoft Project XML').click(); const d = await dl;
    const out = T + 'exported.xml'; fs.copyFileSync(await d.path(), out); const text = fs.readFileSync(out, 'utf8');
    ok(d.suggestedFilename().endsWith('.xml') && /<Project xmlns="http:\/\/schemas\.microsoft\.com\/project">/.test(text), 'not Microsoft Project XML');
    await file('Open'); await chooser(() => tile('Microsoft Project XML').click(), out); const after = await proj(pg);
    eq(after.tasks.map(t => t.name), before.tasks.map(t => t.name)); eq(after.resources.map(r => r.name), before.resources.map(r => r.name)); eq(after.tasks.map(t => t.preds.length), before.tasks.map(t => t.preds.length));
    ok(!/Note:/.test(await toast(pg)), 'import reported problems: ' + await toast(pg)); });
  await step('app: no page errors during any of this', async () => { eq(pg.errors, []); });
  // landing FAQ
  pg = await L.fresh(b); await L.open(pg, '');
  await step('landing: new FAQ answer present (7 questions), and the .mpp row is gone from the table', async () => {
    eq(await pg.locator('.lp-faq details').count(), 7); const q = pg.locator('.lp-faq details', { hasText: 'plan from Microsoft Project' }); await q.locator('summary').click(); ok(/XML/.test(await q.innerText()) && /does not open \.mpp files directly/.test(await q.innerText()), 'answer');
    const rows = await pg.locator('.lp-table tbody th').allInnerTexts(); ok(!rows.some(r => /mpp/i.test(r)), 'row still there: ' + rows.join('|')); eq(rows.length, 7); });
  console.log('SUMMARY', JSON.stringify(L.counts())); await b.close();
})();
