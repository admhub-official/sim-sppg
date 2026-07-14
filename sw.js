const CACHE = 'simsppg-v14';
const SCOPE = self.registration.scope;
const HOME = new URL('./', SCOPE).href;
const DASHBOARD_UI = new URL('dashboard-ui-v2.js?v=2', SCOPE).href;
const DASHBOARD_FIX = new URL('dashboard-ui-fix.js?v=1', SCOPE).href;
const ASSETS = [
  HOME,
  new URL('manifest.json', SCOPE).href,
  new URL('app.js?v=12', SCOPE).href,
  DASHBOARD_UI,
  DASHBOARD_FIX
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function(cache) { return cache.addAll(ASSETS); })
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

function injectDashboardUi(response) {
  if (!response || !response.ok) return Promise.resolve(response);
  var contentType = response.headers.get('content-type') || '';
  if (contentType.indexOf('text/html') === -1) return Promise.resolve(response);

  return response.text().then(function(html) {
    if (html.indexOf('dashboard-ui-v2.js') === -1) {
      var scripts = '<script defer src="/dashboard-ui-v2.js?v=2"></script><script defer src="/dashboard-ui-fix.js?v=1"></script>';
      html = html.indexOf('</body>') > -1 ? html.replace('</body>', scripts + '</body>') : html + scripts;
    }
    var headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(injectDashboardUi)
        .catch(function() {
          return caches.match(HOME).then(injectDashboardUi);
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request, { ignoreSearch: true });
    })
  );
});

function targetUrl(value) {
  try { return new URL(value || './', SCOPE).href; }
  catch (_) { return HOME; }
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