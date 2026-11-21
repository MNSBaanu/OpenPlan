// Builds the app, serves it, and runs every browser suite in e2e/ against it.
// Usage: npm run e2e            (all suites)
//        npm run e2e -- editing (only suites whose file name contains "editing")
// Needs a browser once: npx playwright install chromium
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..');
const shell = process.platform === 'win32';
const only = process.argv.slice(2);
const URL = 'http://localhost:4173/';

console.log('Building the app...');
const build = spawnSync('npx', ['vite', 'build'], { cwd: root, shell, stdio: 'inherit', env: { ...process.env, VITE_COLLAB_URL: 'ws://localhost:8787' } });
if (build.status !== 0) process.exit(build.status || 1);

const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: root, shell, stdio: 'ignore' });
const stop = () => { try { preview.kill(); } catch { /* already stopped */ } if (!shell) spawnSync('pkill', ['-f', 'vite preview']); };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

let up = false;
for (let i = 0; i < 40 && !up; i++) { try { up = (await fetch(URL)).ok; } catch { await new Promise(r => setTimeout(r, 500)); } }
if (!up) { console.error('The preview server did not start.'); process.exit(1); }

const suites = readdirSync(here).filter(f => f.endsWith('.cjs') && f !== 'lib.cjs' && (!only.length || only.some(o => f.includes(o)))).sort();
let failed = 0;
for (const f of suites) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(here, f)], { cwd: here, encoding: 'utf8', timeout: 15 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = out.split('\n').filter(l => /^(FAIL|CRASH)\b/.test(l));
  const summary = (out.match(/SUMMARY.*$/m) || [''])[0];
  const ok = r.status === 0 && !bad.length && /"fail":0/.test(summary);
  console.log((ok ? 'PASS ' : 'FAIL ') + f.padEnd(20) + summary.replace('SUMMARY', '').trim() + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  if (!ok) { failed++; console.log(bad.join('\n') || out.split('\n').slice(-15).join('\n')); }
}
stop();
console.log(failed ? `\n${failed} suite(s) failed.` : '\nAll end-to-end suites passed.');
process.exit(failed ? 1 : 0);
