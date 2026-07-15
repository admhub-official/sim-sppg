const CACHE = 'simsppg-v18-login-fix';
const SCOPE = self.registration.scope;
const HOME = new URL('./', SCOPE).href;
const REPORT_MODULE = new URL('report-download.js', SCOPE).href;
const ASSETS = [
  HOME,
  new URL('manifest.json', SCOPE).href,
  REPORT_MODULE
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

function injectBeforeRealClosingBody(html, scriptTag) {
  // index.html memiliki beberapa teks </body> di dalam string JavaScript untuk
  // dokumen cetak. Gunakan kemunculan terakhir agar script tidak masuk ke string.
  var insertAt = html.toLowerCase().lastIndexOf('</body>');
  if (insertAt === -1) return html + '\n' + scriptTag + '\n';
  return html.slice(0, insertAt) + scriptTag + '\n' + html.slice(insertAt);
}

function injectReportDownloadModule(response) {
  var contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return Promise.resolve(response);

  return response.text().then(function(html) {
    // Hilangkan credential Telegram dari HTML yang disajikan. Jalur laporan lama
    // tidak lagi dimuat; report-download.js menyediakan unduhan PDF/XLSX.
    html = html
      .replace(/(?:const|let|var)\s+TELEGRAM_BOT_TOKEN\s*=\s*[^;]+;/g, "const TELEGRAM_BOT_TOKEN = ''; // Telegram disabled")
      .replace(/(?:const|let|var)\s+TELEGRAM_CHAT_ID\s*=\s*[^;]+;/g, "const TELEGRAM_CHAT_ID = ''; // Telegram disabled")
      .replace(/\s*<script\b[^>]*src=["'][^"']*\/laporan-fix\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi, '\n');

    if (html.indexOf('/report-download.js') === -1 && html.indexOf('src="report-download.js') === -1) {
      html = injectBeforeRealClosingBody(
        html,
        '<script src="/report-download.js?v=20260715-2"></script>'
      );
    }

    var headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    headers.set('pragma', 'no-cache');
    headers.set('expires', '0');
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
        .then(injectReportDownloadModule)
        .catch(function() {
          return caches.match(HOME).then(function(response) {
            return response ? injectReportDownloadModule(response) : Response.error();
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .catch(function() { return caches.match(event.request, { ignoreSearch: true }); })
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