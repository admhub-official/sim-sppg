const CACHE = 'simsppg-v6';
const SCOPE = self.registration.scope;
const HOME = new URL('./', SCOPE).href;
const ASSETS = [
  HOME,
  new URL('manifest.json', SCOPE).href,
  new URL('notification-enhancement.js', SCOPE).href,
  new URL('supabase-config.js', SCOPE).href
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(HOME)));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true })));
});

function targetUrl(value) {
  try { return new URL(value || './', SCOPE).href; }
  catch (_) { return HOME; }
}

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { body: event.data ? event.data.text() : 'Ada notifikasi baru.' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'SIM-SPPG', {
    body: data.body || 'Ada aktivitas baru yang perlu diperiksa.',
    icon: data.icon || 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png',
    badge: data.badge || 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png',
    tag: data.tag || 'sim-sppg-notif',
    data: { url: targetUrl(data.url) }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = targetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('navigate' in client) client.navigate(url);
      if ('focus' in client) return client.focus();
    }
    return clients.openWindow ? clients.openWindow(url) : undefined;
  }));
});
