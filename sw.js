/* SIM-SPPG service worker
 * Network-first for application shell so deployments are not trapped by stale HTML/JS.
 * Cache-first only for stable static assets. API and Supabase requests are never cached.
 */
const CACHE_VERSION = 'sim-sppg-v20260717-uiux-2';
const APP_SHELL = ['./', './index.html', './app.js', './uiux-fixes.js', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isBackendRequest(url) {
  return url.hostname.endsWith('supabase.co') || url.pathname.includes('/functions/v1/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isBackendRequest(url)) return;

  const isNavigation = request.mode === 'navigate';
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Inject isolated UI/UX runtime after the existing app bundle without
  // replacing the large app.js file. This keeps the patch reversible.
  if (url.origin === self.location.origin && /\/app\.js$/.test(url.pathname)) {
    event.respondWith(
      Promise.all([
        fetch(request).then((r) => r.text()),
        fetch('./uiux-fixes.js').then((r) => r.text())
      ]).then(([appSource, fixesSource]) => new Response(
        appSource + '\n\n/* injected by sw.js */\n' + fixesSource,
        { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } }
      )).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
