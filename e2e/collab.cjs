// End-to-end test: drives the built app in a real browser. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok, toast, confirm, clean } = L;
const { spawn } = require('child_process');
const REPO = require('path').join(__dirname, '..', 'collab-server');
let relay;
const startRelay = async () => { relay = spawn('npx', ['wrangler', 'dev', '--port', '8787', '--var', 'ALLOWED_ORIGINS:http://localhost:4173'], { cwd: REPO, stdio: 'ignore', detached: true }); for (let i = 0; i < 60; i++) { try { const r = await fetch('http://localhost:8787/'); if (r.ok) return; } catch {} await new Promise(r => setTimeout(r, 1000)); } throw new Error('relay did not start'); };
const stopRelay = async () => { try { process.kill(-relay.pid, 'SIGKILL'); } catch {} await new Promise(r => setTimeout(r, 1500)); };
const until = async (fn, ms = 6000, msg = 'condition') => { const end = Date.now() + ms; let last; for (;;) { try { last = await fn(); if (last) return last; } catch (e) { last = e.message; } if (Date.now() > end) throw new Error('timeout: ' + msg + ' (last: ' + JSON.stringify(last) + ')'); await new Promise(r => setTimeout(r, 150)); } };
const name = (pg, n) => pg.locator('[aria-label="Task ' + n + ' name"]').inputValue();
const dur = (pg, n) => pg.locator('[aria-label="Task ' + n + ' Duration"]').inputValue();
const rowCount = pg => pg.locator('table.grid tbody tr').count().then(n => n - 1);
const badge = pg => pg.locator('.live-badge').innerText().catch(() => '');
const frames = []; 
(async () => {
  await startRelay(); const b = await L.launch();
  const A = await L.fresh(b), Bp = await L.fresh(b), Cp = await L.fresh(b);
  for (const p of [A, Bp, Cp]) p.on('websocket', ws => ws.on('framesent', f => frames.push(String(f.payload))));
  await L.open(A); let invite;
  await step('A: Share dialog offers a live session; Start makes an invite link', async () => {
    await A.locator('button[aria-label="Share a copy as a link"]').click(); await A.waitForSelector('.live-box'); await A.locator('.live-box .btn.primary', { hasText: 'Start a live session' }).click();
    await until(async () => /Live/.test(await badge(A)), 8000, 'badge live'); invite = await A.locator('input[aria-label="Invite link"]').inputValue(); ok(/#collab=[\w-]{22}\.[\w-]{43}$/.test(invite), invite); await A.keyboard.press('Escape'); return (await badge(A)); });
  await step('B (another browser) opens the link, confirms, and gets A\'s plan', async () => {
    await Bp.goto(invite); await Bp.waitForSelector('dialog[open]'); ok(/live session/i.test(await Bp.locator('dialog[open]').innerText()), 'no join prompt'); await confirm(Bp);
    await Bp.waitForSelector('.ribbon-tabs'); await until(async () => /Live · 2/.test(await badge(Bp)), 8000, 'B live 2'); eq(await rowCount(Bp), 22); eq(await name(Bp, 3), await name(A, 3)); await until(async () => /Live · 2/.test(await badge(A)), 5000, 'A sees 2'); });
  await step('A edits a task name → B sees it live; B edits a duration → A sees it', async () => {
    const a = A.locator('[aria-label="Task 3 name"]'); await a.fill('Typed by A'); await a.press('Enter'); await until(async () => (await name(Bp, 3)) === 'Typed by A', 5000, 'B sees name');
    const d = Bp.locator('[aria-label="Task 4 Duration"]'); await d.fill('7d'); await d.press('Enter'); await until(async () => (await dur(A, 4)) === '7d', 5000, 'A sees duration'); });
  await step('schedule recalculates for both after a remote change (same finish date)', async () => { const fin = p => p.locator('table.grid tbody tr:nth-child(22) td.ro').nth(1).innerText(); await until(async () => (await fin(A)) === (await fin(Bp)), 4000, 'same finish'); return await fin(A); });
  await step('both add a task at the same moment → 24 tasks, same on both, no clashes', async () => {
    const add = async (p, nm) => { await p.locator('.ribbon-tabs .rtab', { hasText: 'Task' }).click(); await p.locator('.ribbon button', { hasText: /^Task$/ }).first().click(); await p.keyboard.type(nm); await p.keyboard.press('Enter'); };
    await Promise.all([add(A, 'From A'), add(Bp, 'From B')]);
    await until(async () => (await rowCount(A)) === 24 && (await rowCount(Bp)) === 24, 8000, '24 rows');
    const names = async p => p.locator('table.grid tbody tr input[aria-label$=" name"]').evaluateAll(es => es.map(e => e.value).filter(Boolean)); await until(async () => JSON.stringify(await names(A)) === JSON.stringify(await names(Bp)), 8000, 'same task names on both'); const na = await names(A), nb = await names(Bp);
    eq(na, nb); ok(na.includes('From A') && na.includes('From B'), 'missing'); });
  await step('edits to different fields of the same task at once both survive', async () => {
    await Promise.all([(async () => { const a = A.locator('[aria-label="Task 6 name"]'); await a.fill('Sprint one (A)'); await a.press('Enter'); })(), (async () => { const d = Bp.locator('[aria-label="Task 5 Duration"]'); await d.fill('3d'); await d.press('Enter'); })()]);
    await until(async () => (await name(Bp, 6)) === 'Sprint one (A)' && (await dur(A, 5)) === '3d', 6000, 'both changes'); });
  await step('undo is personal: A undoes only A\'s own change, B\'s stays', async () => {
    const a = A.locator('[aria-label="Task 8 name"]'); await a.fill('A change'); await a.press('Enter'); await until(async () => (await name(Bp, 8)) === 'A change', 4000, 'B sees A change');
    const d = Bp.locator('[aria-label="Task 9 Duration"]'); await d.fill('8d'); await d.press('Enter'); await until(async () => (await dur(A, 9)) === '8d', 4000, 'A sees B change');
    await A.locator('button[aria-label="Undo"]').click(); await until(async () => (await name(A, 8)) !== 'A change' && (await name(Bp, 8)) !== 'A change', 4000, 'A change undone');
    eq(await dur(A, 9), '8d', 'B change must stay'); eq(await dur(Bp, 9), '8d'); ok(await Bp.locator('button[aria-label="Undo"]').isEnabled(), 'B undo should still be available'); });
  await step('B undo/redo reverts B\'s own change on both screens', async () => {
    await Bp.locator('button[aria-label="Undo"]').click(); await until(async () => (await dur(A, 9)) !== '8d' && (await dur(Bp, 9)) !== '8d', 4000, 'undone'); await Bp.locator('button[aria-label="Redo"]').click(); await until(async () => (await dur(A, 9)) === '8d', 4000, 'redone'); });
  await step('names and colours: each person sees who else is here, with the name they chose', async () => {
    const setName = async (p, nm) => { await p.locator('button[aria-label="Share a copy as a link"]').click(); await p.waitForSelector('.live-box'); const i = p.locator('input[aria-label="Your name"]'); await i.fill(nm); await i.press('Enter'); };
    await setName(A, 'Ana Silva'); await A.keyboard.press('Escape'); await setName(Bp, 'Bo Chen');
    const listed = async p => (await p.locator('ul.people li').allInnerTexts()).map(t => t.replace(/\s*\(you\)/, '').trim()).sort().join('|');
    await until(async () => (await listed(Bp)) === 'Ana Silva|Bo Chen', 15000, 'B sees both names (got ' + await listed(Bp) + ')'); await Bp.keyboard.press('Escape');
    await until(async () => (await A.locator('.live-badge .avatar').allInnerTexts()).join() === 'BC', 15000, 'A sees B\'s initials on the badge');
    eq(await A.locator('.live-badge .avatar').first().getAttribute('title'), 'Bo Chen'); });
  await step('a row another person has selected is marked with their name', async () => {
    await Bp.locator('[aria-label="Task 10 name"]').click(); await until(async () => (await A.locator('table.grid tr.peer').count()) === 1, 15000, 'A sees a marked row');
    eq(await A.locator('table.grid tr.peer input[aria-label$=" name"]').getAttribute('aria-label'), 'Task 10 name'); eq(await A.locator('table.grid tr.peer .namecell').evaluate(e => getComputedStyle(e, '::after').content), '"Bo Chen"');
    await Bp.locator('[aria-label="Task 11 name"]').click(); await until(async () => (await A.locator('table.grid tr.peer input[aria-label$=" name"]').getAttribute('aria-label').catch(() => '')) === 'Task 11 name', 15000, 'mark moves'); });
  await step('comments: each person comments on the same task at the same time; both appear, with names, for both', async () => {
    for (const p of [A, Bp]) await p.locator('[aria-label="Task 12 name"]').click();
    const say = async (p, text) => { const box = p.locator('.comments textarea'); await box.fill(text); await box.press('Control+Enter'); };
    await Promise.all([say(A, 'Checked with the client'), say(Bp, 'Needs a second reviewer')]);
    for (const p of [A, Bp]) await until(async () => (await p.locator('.comment').count()) === 2, 15000, 'two comments');
    const read = async p => (await p.locator('.comment').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).sort();
    eq(await read(A), await read(Bp)); const joined = (await read(A)).join('|'); ok(/Ana Silva.*Checked with the client/.test(joined) && /Bo Chen.*Needs a second reviewer/.test(joined), joined);
    ok(/^Comments \(2\)/.test(await A.locator('.comments .section-title').innerText()), 'count');
    await A.locator('.comment', { hasText: 'Checked with the client' }).locator('button[aria-label="Delete comment"]').click(); for (const p of [A, Bp]) await until(async () => (await p.locator('.comment').count()) === 1, 15000, 'one comment left'); });
  await step('traffic on the wire is encrypted (no task names or plan text in any message)', async () => {
    const all = frames.join('\n'); ok(all.length > 500, 'no frames captured: ' + all.length); for (const s of ['Typed by A', 'From A', 'Library Booking', 'Kick-off', 'Gather requirements', 'Ana Silva', 'Bo Chen', 'second reviewer']) ok(!all.includes(s), 'plaintext leaked: ' + s); return frames.length + ' frames checked'; });
  await step('pages show no broken numbers and no errors during all of this', async () => { await clean(A); await clean(Bp); eq(A.errors.filter(e => !/WebSocket|ERR_/.test(e)), []); eq(Bp.errors.filter(e => !/WebSocket|ERR_/.test(e)), []); });
  await step('late joiner C gets the full, current plan', async () => {
    await Cp.goto(invite); await confirm(Cp); await Cp.waitForSelector('.ribbon-tabs'); await until(async () => /Live · 3/.test(await badge(Cp)), 8000, 'C live 3'); eq(await rowCount(Cp), 24); eq(await name(Cp, 3), 'Typed by A'); eq(await dur(Cp, 9), '8d'); });
  await step('relay goes down: badge shows Reconnecting, edits continue, all converge when it returns', async () => {
    await stopRelay(); await until(async () => /Reconnecting/.test(await badge(Bp)), 8000, 'reconnecting badge');
    const d = Bp.locator('[aria-label="Task 10 Duration"]'); await d.fill('6d'); await d.press('Enter'); const a = A.locator('[aria-label="Task 11 name"]'); await a.fill('Offline edit A'); await a.press('Enter');
    await startRelay(); await until(async () => (await dur(A, 10)) === '6d' && (await name(Bp, 11)) === 'Offline edit A' && (await name(Cp, 11)) === 'Offline edit A', 30000, 'converge after restart'); await until(async () => /Live/.test(await badge(Bp)), 20000, 'live again'); });
  await step('reload keeps the session: A rejoins automatically with the same plan', async () => {
    await A.reload(); await A.waitForSelector('.ribbon-tabs'); await until(async () => /Live · 3/.test(await badge(A)), 12000, 'A rejoined'); eq(await name(A, 3), 'Typed by A'); eq(await rowCount(A), 24); });
  await step('inside a live session, File ▸ New is refused with a clear message', async () => {
    await A.locator('.rtab.file').click(); await A.locator('.bs-item', { hasText: 'New' }).click(); await A.locator('.bs-card', { hasText: 'Blank Project' }).click(); await confirm(A); ok(/Leave the live session/.test(await toast(A)), await toast(A)); eq(await rowCount(A), 24); });
  await step('compaction: 260 quick edits do not grow the stored history without limit', async () => {
    await L.open(A); const inp = A.locator('[aria-label="Task 12 name"]'); for (let i = 0; i < 260; i++) { await inp.fill('Edit ' + i); await inp.press('Enter'); }
    await until(async () => (await name(Bp, 12)) === 'Edit 259', 15000, 'B sees last edit'); await new Promise(r => setTimeout(r, 1500));
    const count = await new Promise((res, rej) => { const room = invite.split('#collab=')[1].split('.')[0]; const ws = new WebSocket('ws://localhost:8787/room/' + room, { headers: { Origin: 'http://localhost:4173' } }); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'ready') { res(m.count); ws.close(); } }; ws.onerror = rej; });
    ok(count < 150, 'history still has ' + count + ' entries'); return count + ' stored entries after 260+ edits'; });
  await step('B still has the same plan as A after compaction, and a new joiner reads the compacted history', async () => { eq(await name(Bp, 12), 'Edit 259'); const D = await L.fresh(b); await D.goto(invite); await confirm(D); await D.waitForSelector('.ribbon-tabs'); await until(async () => (await name(D, 12)) === 'Edit 259' && (await rowCount(D)) === 24, 10000, 'D has plan'); await D.context().close(); });
  await step('a made-up or ended session link is refused and the local plan is untouched', async () => {
    const E = await L.fresh(b); await L.open(E); const before = await rowCount(E); await E.goto('http://localhost:4173/#collab=AAAAAAAAAAAAAAAAAAAAAA.' + invite.split('.')[1]); await confirm(E); await until(async () => /ended|wrong/.test(await toast(E)), 10000, 'error toast'); eq(await rowCount(E), before); await E.context().close(); });
  await step('Leave: A returns to a normal plan (keeps the data); B sees 2 people', async () => {
    await A.locator('button[aria-label="Share a copy as a link"]').click(); await A.locator('.live-box .btn', { hasText: 'Leave the session' }).click(); await until(async () => !(await A.locator('.live-badge').count()), 4000, 'badge gone'); eq(await rowCount(A), 24);
    await until(async () => /Live · 2/.test(await badge(Bp)), 6000, 'B sees 2'); await A.keyboard.press('Escape'); const keep = await A.evaluate(() => JSON.parse(localStorage.getItem('openplan.project')).tasks.length); eq(keep, 24);
    await A.reload(); await A.waitForSelector('.ribbon-tabs'); await new Promise(r => setTimeout(r, 1500)); eq(await A.locator('.live-badge').count(), 0, 'must not rejoin after leaving'); });
  await step('after leaving, A\'s edits no longer reach B, and undo is the normal kind again', async () => { const a = A.locator('[aria-label="Task 3 name"]'); await a.fill('Private now'); await a.press('Enter'); await new Promise(r => setTimeout(r, 1200)); eq(await name(Bp, 3), 'Typed by A'); ok(await A.locator('button[aria-label="Undo"]').isEnabled(), 'undo should work'); });
  console.log('\nSUMMARY', JSON.stringify(L.counts())); await b.close(); await stopRelay(); process.exit(0);
})().catch(async e => { console.log('CRASH', e.message); await stopRelay(); process.exit(1); });
