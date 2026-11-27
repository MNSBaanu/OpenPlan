// Stamps the service worker after `vite build`, so each deploy gets its own cache.
// public/sw.js says `const BUILD = { version: 'dev', files: [] };`. In dist/sw.js this becomes a short
// hash of every other built file (it changes whenever any file changes) and the list of built files
// with a hash in their names, which the new service worker stores when it installs.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PLACEHOLDER = "const BUILD = { version: 'dev', files: [] };";
const HASHED = /-[\w-]{8}\.(js|css|woff2)$/;   // the same test as in sw.js

/** Every file in `dir` except sw.js, as sorted paths relative to `dir` with forward slashes. */
function builtFiles(dir) {
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  return walk(dir).map(p => relative(dir, p).split(sep).join('/')).filter(f => f !== 'sw.js').sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** A short hash of every file in `dir` except sw.js itself, by path and content. */
export function buildVersion(dir) {
  const hash = createHash('sha256');
  for (const f of builtFiles(dir)) hash.update(f).update('\0').update(readFileSync(join(dir, f))).update('\0');
  return hash.digest('hex').slice(0, 12);
}

/** Fills in BUILD in dir/sw.js and returns it. Fails the build if the placeholder is missing. */
export function stampServiceWorker(dir) {
  const file = join(dir, 'sw.js');
  const text = readFileSync(file, 'utf8');
  if (!text.includes(PLACEHOLDER)) throw new Error(`sw.js: could not find ${PLACEHOLDER} to fill in the build version`);
  const build = { version: buildVersion(dir), files: builtFiles(dir).filter(f => HASHED.test(f)).map(f => './' + f) };
  writeFileSync(file, text.replace(PLACEHOLDER, `const BUILD = ${JSON.stringify(build)};`));
  return build;
}

/** Vite plugin: stamps dist/sw.js after a production build. */
export function swVersion() {
  return {
    name: 'openplan-sw-version',
    apply: 'build',
    writeBundle(options) { stampServiceWorker(options.dir); }
  };
}
