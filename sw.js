/* SIM-SPPG service worker
 * Network-first for navigation and JavaScript bundles.
 * Backend and Supabase requests are never cached.
 */
const CACHE_VERSION = 'sim-sppg-v20260722-approval-canonical-source-v16';
const APP_SHELL = ['./index.html', './app.js', './manifest.json', './professional-report-v1.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all(APP_SHELL.map(async (path) => {
        const response = await fetch(path, { cache: 'reload' });
        if (!response || !response.ok) throw new Error(`Gagal memuat app shell: ${path}`);
        await cache.put(path, response);
      })))
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

function networkFirst(request, cacheKey) {
  return fetch(request, { cache: 'no-store' })
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(cacheKey || request, copy));
      }
      return response;
    })
    .catch(() => caches.match(cacheKey || request));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isBackendRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (url.origin === self.location.origin && /\.(?:js|html)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request));
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
