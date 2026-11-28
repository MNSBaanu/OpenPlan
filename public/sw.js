// OpenPlan offline support: pages load from the network when online and from the cache when offline.
// Built files have content hashes in their names, so they are served from the cache once stored.
// Other files (the manifest, robots.txt, icons) are fetched from the network first, so a new deploy
// shows up on the next load, and come from the cache only when the network fails.
// `npm run build` fills in BUILD (see scripts/sw-version.mjs): a hash of the built files, so every deploy
// gets a new cache and the old one is deleted when the new service worker takes over, and the list of
// built files, so the new cache holds the whole app and it still opens offline right after a deploy.
const BUILD = { version: 'dev', files: [] };
const CACHE = 'openplan-' + BUILD.version;
const HASHED = /-[\w-]{8}\.(js|css|woff2)$/;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', './index.html', ...BUILD.files])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(req).then(hit => {
    if (hit && HASHED.test(url.pathname)) return hit;
    return fetch(req)
      .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(err => { if (hit) return hit; throw err; });
  })));
});
