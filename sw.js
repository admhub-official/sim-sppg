const CACHE = 'simsppg-v23-unified-runtime';
const SCOPE = self.registration.scope;
const MANIFEST = new URL('manifest.json', SCOPE).href;
const APP_RUNTIME = new URL('assets/js/app.js?v=20260715-1', SCOPE).href;
const STATIC_ASSETS = [MANIFEST, APP_RUNTIME];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function(cache) { return cache.addAll(STATIC_ASSETS); })
      .catch(function() { return undefined; })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.filter(function(key) { return key !== CACHE; }).map(function(key) { return caches.delete(key); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store', redirect: 'follow' })
        .catch(function() {
          return new Response(
            '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIM-SPPG</title><body style="font-family:system-ui;padding:24px"><h2>Koneksi tidak tersedia</h2><p>Periksa koneksi internet lalu muat ulang halaman.</p><button onclick="location.reload()">Muat ulang</button></body></html>',
            { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
          );
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(function(response) {
        if (!response || !response.ok || response.type === 'opaque') return response;
        var copy = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(event.request, copy); });
        return response;
      })
      .catch(function() { return caches.match(event.request, { ignoreSearch: true }); })
  );
});

function targetUrl(value) {
  try { return new URL(value || './', SCOPE).href; }
  catch (_) { return SCOPE; }
}

self.addEventListener('push', function(event) {
  var data = {};
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

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = targetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i += 1) {
        var client = list[i];
        if ('navigate' in client) client.navigate(url);
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow ? clients.openWindow(url) : undefined;
    })
  );
});