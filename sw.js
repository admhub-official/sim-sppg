/* SIM-SPPG service worker
 * Network-first for navigation and JavaScript bundles.
 * Backend and Supabase requests are never cached.
 */
const CACHE_VERSION = 'sim-sppg-v20260819-auth-recovery-v3';
const APP_SHELL = [
  './index.html',
  './app.js',
  './manifest.json',
  './transaction-category-supplier-rules.js',
  './supplier-inline-create.js',
  './professional-report-v1.js'
];

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

function normalizeNotificationPayload(event) {
  const fallback = { title: 'Pengumuman SIM-SPPG', body: 'Ada pengumuman baru untuk Anda.', url: '#dashboard' };
  if (!event.data) return fallback;
  try {
    const parsed = event.data.json();
    return {
      title: String(parsed.title || fallback.title).slice(0, 120),
      body: String(parsed.body || fallback.body).slice(0, 500),
      url: String(parsed.url || fallback.url).slice(0, 500)
    };
  } catch (_) {
    const body = event.data.text();
    return { ...fallback, body: String(body || fallback.body).slice(0, 500) };
  }
}

self.addEventListener('push', (event) => {
  const payload = normalizeNotificationPayload(event);
  const targetUrl = new URL(payload.url || '#dashboard', self.registration.scope).href;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png',
      tag: `sim-sppg-announcement-${Date.now()}`,
      renotify: true,
      silent: false,
      requireInteraction: payload.title.toLowerCase().includes('mendesak'),
      data: { url: targetUrl },
      vibrate: [220, 100, 220, 100, 320]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : new URL('#dashboard', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (typeof client.navigate === 'function') await client.navigate(targetUrl);
        if (typeof client.focus === 'function') return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
