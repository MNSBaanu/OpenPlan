import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildVersion, stampServiceWorker } from './sw-version.mjs';

const SW = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://openplan.test';

/** A fake dist folder holding the real sw.js and a few built files. */
function dist(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'openplan-sw-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'sw.js'), SW);
  writeFileSync(join(dir, 'index.html'), '<!doctype html>');
  writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"OpenPlan"}');
  writeFileSync(join(dir, 'assets', 'App-AbCd1234.js'), 'app()');
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

/** Runs a service worker script with fake caches and a fake network; returns helpers to drive it. */
function worker(script, { caches: start = {}, network = {} } = {}) {
  const store = new Map(Object.entries(start).map(([name, entries]) => [name, new Map(Object.entries(entries))]));
  const key = req => new URL(typeof req === 'string' ? req : req.url, ORIGIN + '/').href;
  const open = name => {
    if (!store.has(name)) store.set(name, new Map());
    const c = store.get(name);
    return {
      match: async req => { const t = c.get(key(req)); return t === undefined ? undefined : new Response(t); },
      put: async (req, res) => { c.set(key(req), await res.text()); },
      addAll: async urls => { for (const u of urls) c.set(key(u), net.get(key(u)) ?? ''); }
    };
  };
  const net = new Map(Object.entries(network).map(([u, t]) => [key(u), t]));
  let online = true;
  const listeners = {};
  const self = { addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
  const caches = {
    open: async name => open(name),
    keys: async () => [...store.keys()],
    delete: async name => store.delete(name),
    match: async req => { for (const name of store.keys()) { const hit = await open(name).match(req); if (hit) return hit; } }
  };
  const fetch = async req => {
    if (!online) throw new TypeError('Failed to fetch');
    const t = net.get(key(req));
    return t === undefined ? new Response('', { status: 404 }) : new Response(t);
  };
  runInNewContext(script, { self, caches, fetch, location: new URL(ORIGIN + '/'), URL, Response, Promise });
  const lifecycle = async type => { let p; listeners[type]({ waitUntil: x => { p = x; } }); await p; };
  return {
    store,
    setNetwork: (u, t) => net.set(key(u), t),
    offline: () => { online = false; },
    install: () => lifecycle('install'),
    activate: () => lifecycle('activate'),
    async get(path, mode = 'no-cors') {
      let reply; const pending = [];
      listeners.fetch({ request: { url: key(path), method: 'GET', mode }, respondWith: r => { reply = r; }, waitUntil: p => pending.push(p) });
      if (!reply) return undefined;
      const text = await (await reply).text();
      await Promise.all(pending);
      return text;
    }
  };
}

describe('service worker version', () => {
  it('fills in dist/sw.js with a hash of the built files and the list of hashed files', () => {
    const dir = dist();
    try {
      const build = stampServiceWorker(dir);
      expect(build.version).toMatch(/^[0-9a-f]{12}$/);
      expect(build.files).toEqual(['./assets/App-AbCd1234.js']);
      const out = readFileSync(join(dir, 'sw.js'), 'utf8');
      expect(out).toContain(`const BUILD = ${JSON.stringify(build)};`);
      expect(out).not.toContain("version: 'dev'");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('gives a new version when any built file changes, and the same one when nothing does', () => {
    const a = dist(), b = dist(), c = dist({ 'manifest.webmanifest': '{"name":"OpenPlan 2"}' });
    try {
      expect(buildVersion(a)).toBe(buildVersion(b));
      expect(buildVersion(a)).not.toBe(buildVersion(c));
    } finally { for (const d of [a, b, c]) rmSync(d, { recursive: true, force: true }); }
  });

  it('fails the build when sw.js no longer has the version line', () => {
    const dir = dist({ 'sw.js': "const CACHE = 'openplan-v1';" });
    try { expect(() => stampServiceWorker(dir)).toThrow(/BUILD/); } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('service worker caching', () => {
  const stamped = (version, files = []) => SW.replace("const BUILD = { version: 'dev', files: [] };", `const BUILD = ${JSON.stringify({ version, files })};`);

  it('deletes the cache of the previous deploy when the new one takes over', async () => {
    const sw = worker(stamped('new'), { caches: { 'openplan-old': { [`${ORIGIN}/robots.txt`]: 'old' } }, network: { './': 'page', './index.html': 'page' } });
    await sw.install();
    await sw.activate();
    expect([...sw.store.keys()]).toEqual(['openplan-new']);
  });

  it('serves a new manifest on the first load after a deploy, not the cached one', async () => {
    const sw = worker(stamped('a'), { network: { '/manifest.webmanifest': 'v1' } });
    expect(await sw.get('/manifest.webmanifest')).toBe('v1');
    sw.setNetwork('/manifest.webmanifest', 'v2');
    expect(await sw.get('/manifest.webmanifest')).toBe('v2');
  });

  it('still works offline: pages and files come from the cache', async () => {
    const sw = worker(stamped('a'), { network: { './': 'page', './index.html': 'page', '/manifest.webmanifest': 'm', '/assets/App-AbCd1234.js': 'app()' } });
    await sw.install();
    await sw.activate();
    await sw.get('/manifest.webmanifest');
    await sw.get('/assets/App-AbCd1234.js');
    sw.offline();
    expect(await sw.get('/#app', 'navigate')).toBe('page');
    expect(await sw.get('/manifest.webmanifest')).toBe('m');
    expect(await sw.get('/assets/App-AbCd1234.js')).toBe('app()');
  });

  it('opens offline right after a deploy: the new cache holds the whole new build', async () => {
    const files = ['./assets/index-NewHash1.js', './assets/App-NewHash2.js'];
    const sw = worker(stamped('new', files), {
      caches: { 'openplan-old': { [`${ORIGIN}/index.html`]: 'old page', [`${ORIGIN}/assets/index-OldHash1.js`]: 'old' } },
      network: { './': 'page', './index.html': 'page', [files[0]]: 'index()', [files[1]]: 'app()' }
    });
    await sw.install();
    await sw.activate();
    sw.offline();
    expect(await sw.get('/#app', 'navigate')).toBe('page');
    expect(await sw.get('/assets/index-NewHash1.js')).toBe('index()');
    expect(await sw.get('/assets/App-NewHash2.js')).toBe('app()');
  });

  it('serves hashed build files from the cache once stored', async () => {
    const sw = worker(stamped('a'), { network: { '/assets/App-AbCd1234.js': 'app()' } });
    await sw.get('/assets/App-AbCd1234.js');
    sw.setNetwork('/assets/App-AbCd1234.js', 'changed');
    expect(await sw.get('/assets/App-AbCd1234.js')).toBe('app()');
  });
});
