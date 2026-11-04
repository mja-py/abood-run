// Service worker: caches the whole game so it loads instantly and plays offline.
// The deploy workflow replaces __BUILD__ with the commit id, so every push gets a fresh cache.
const VERSION = '__BUILD__';
const CACHE = 'abood-run-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/game.js',
  './js/i18n.js',
  './js/vendor/zzfx.js',
  './assets/fonts/baloo-bhaijaan-2-arabic-500-normal.woff2',
  './assets/fonts/baloo-bhaijaan-2-arabic-700-normal.woff2',
  './assets/fonts/baloo-bhaijaan-2-arabic-800-normal.woff2',
  './assets/fonts/baloo-bhaijaan-2-latin-500-normal.woff2',
  './assets/fonts/baloo-bhaijaan-2-latin-700-normal.woff2',
  './assets/fonts/baloo-bhaijaan-2-latin-800-normal.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' skips the browser's HTTP cache so a new version never stores stale files
    await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('abood-run-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: try the network first (so updates show up), fall back to the cached copy offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(req, { signal: ctrl.signal }); clearTimeout(timer);
        if (res.ok) { const cache = await caches.open(CACHE); cache.put('./index.html', res.clone()); }
        return res;
      } catch (e) {
        return (await caches.match('./index.html', { ignoreSearch: true })) || (await caches.match('./', { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  // Everything else (scripts, styles, fonts, icons): cache first, then network.
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') { const cache = await caches.open(CACHE); cache.put(req, res.clone()); }
      return res;
    } catch (e) { return Response.error(); }
  })());
});
