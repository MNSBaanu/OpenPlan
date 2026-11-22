// End-to-end test: drives the built app in a real browser. Run all suites with `npm run e2e`.
const L = require('./lib.cjs'); const { step, eq, ok, confirm } = L; const { spawn } = require('child_process');
let relay; const until = async (fn, ms = 6000, m = 'cond') => { const end = Date.now() + ms; let last; for (;;) { try { last = await fn(); if (last) return last; } catch (e) { last = e.message; } if (Date.now() > end) throw new Error('timeout ' + m + ' ' + JSON.stringify(last)); await new Promise(r => setTimeout(r, 150)); } };
(async () => {
  relay = spawn('npx', ['wrangler', 'dev', '--port', '8787', '--var', 'ALLOWED_ORIGINS:http://localhost:4173'], { cwd: require('path').join(__dirname, '..', 'collab-server'), stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:8787/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }
  const b = await L.launch(); const A = await L.fresh(b), B = await L.fresh(b); await L.open(A);
  await A.locator('button[aria-label="Share a copy as a link"]').click(); await A.locator('.live-box .btn.primary').click(); await A.waitForSelector('.live-badge'); const invite = await A.locator('input[aria-label="Invite link"]').inputValue(); await A.keyboard.press('Escape');
  await B.goto(invite); await confirm(B); await B.waitForSelector('.ribbon-tabs'); await until(async () => /Live · 2/.test(await B.locator('.live-badge').innerText({ timeout: 1000 }).catch(() => '')), 25000, 'B live');
  const val = (p, n) => p.locator('[aria-label="Task ' + n + ' name"]').inputValue();
  await step('B has a cell focused but untouched → still sees A\'s change to it', async () => { await B.locator('[aria-label="Task 8 name"]').focus(); const a = A.locator('[aria-label="Task 8 name"]'); await a.fill('From A while B focused'); await a.press('Enter'); await until(async () => (await val(B, 8)) === 'From A while B focused', 5000, 'B updated'); });
  await step('B is typing in a cell → A\'s change does not wipe what B typed', async () => { const bi = B.locator('[aria-label="Task 9 name"]'); await bi.click(); await B.keyboard.press('End'); await B.keyboard.type(' typing…'); const typed = await val(B, 9); const a = A.locator('[aria-label="Task 9 name"]'); await a.fill('A changes 9'); await a.press('Enter'); await new Promise(r => setTimeout(r, 1500)); eq(await val(B, 9), typed, 'B text must be kept while typing'); });
  await step('…and when B finishes (Enter), B\'s text is saved and A sees it', async () => { const typed = await val(B, 9); await B.keyboard.press('Enter'); await until(async () => (await val(A, 9)) === typed, 5000, 'A sees B text'); });
  await step('Escape in a cell still reverts to the shared value', async () => { const bi = B.locator('[aria-label="Task 10 name"]'); const orig = await val(B, 10); await bi.click(); await B.keyboard.type('zzz'); await B.keyboard.press('Escape'); eq(await val(B, 10), orig); });
  await step('no errors', async () => { eq([...A.errors, ...B.errors], []); });
  console.log('SUMMARY', JSON.stringify(L.counts())); await b.close(); try { process.kill(-relay.pid, 'SIGKILL'); } catch {} process.exit(0);
})().catch(e => { console.log('CRASH', e.message); try { process.kill(-relay.pid, 'SIGKILL'); } catch {} process.exit(1); });
