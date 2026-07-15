const CACHE = 'simsppg-v20-auth-rbac-print';
const SCOPE = self.registration.scope;
const HOME = new URL('./', SCOPE).href;
const REPORT_MODULE = new URL('report-download.js', SCOPE).href;
const REPORT_RUNTIME = new URL('report-runtime-fix.js', SCOPE).href;
const AUTH_UI = new URL('auth-ui-v2.js', SCOPE).href;
const ASSETS = [HOME, new URL('manifest.json', SCOPE).href, REPORT_MODULE, REPORT_RUNTIME, AUTH_UI];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE).then(function(cache) { return cache.addAll(ASSETS); }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(key) { return key !== CACHE; }).map(function(key) { return caches.delete(key); }));
  }).then(function() { return self.clients.claim(); }));
});

function injectBeforeRealClosingBody(html, script) {
  var insertAt = html.toLowerCase().lastIndexOf('</body>');
  if (insertAt === -1) return html + '\n' + script;
  return html.slice(0, insertAt) + script + '\n' + html.slice(insertAt);
}

function injectRuntimeModules(response) {
  var contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return Promise.resolve(response);
  return response.text().then(function(html) {
    html = html
      .replace(/(?:const|let|var)\s+TELEGRAM_BOT_TOKEN\s*=\s*[^;]+;/g, "const TELEGRAM_BOT_TOKEN = ''; // Telegram disabled")
      .replace(/(?:const|let|var)\s+TELEGRAM_CHAT_ID\s*=\s*[^;]+;/g, "const TELEGRAM_CHAT_ID = ''; // Telegram disabled");
    if (html.indexOf('report-download.js') === -1) html = injectBeforeRealClosingBody(html, '<script src="report-download.js?v=20"></script>');
    if (html.indexOf('report-runtime-fix.js') === -1) html = injectBeforeRealClosingBody(html, '<script src="report-runtime-fix.js?v=20"></script>');
    if (html.indexOf('auth-ui-v2.js') === -1) html = injectBeforeRealClosingBody(html, '<script src="auth-ui-v2.js?v=20"></script>');

    var headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.set('cache-control', 'no-store');
    return new Response(html, { status: response.status, statusText: response.statusText, headers: headers });
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(injectRuntimeModules).catch(function() {
      return caches.match(HOME).then(function(response) { return response ? injectRuntimeModules(response) : Response.error(); });
    }));
    return;
  }
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(function() { return caches.match(event.request, { ignoreSearch: true }); }));
});

function targetUrl(value) { try { return new URL(value || './', SCOPE).href; } catch (_) { return HOME; } }
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : 'Ada notifikasi baru.' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'SIM-SPPG', {
    body: data.body || 'Ada aktivitas baru yang perlu diperiksa.',
    icon: data.icon || 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png',
    badge: data.badge || 'https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png',
    tag: data.tag || 'sim-sppg-notif', data: { url: targetUrl(data.url) }
  }));
});
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = targetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i += 1) {
      var client = list[i];
      if ('navigate' in client) client.navigate(url);
      if ('focus' in client) return client.focus();
    }
    return clients.openWindow ? clients.openWindow(url) : undefined;
  }));
});