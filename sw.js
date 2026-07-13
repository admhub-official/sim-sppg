const CACHE = 'simsppg-v9';
const SCOPE = self.registration.scope;
const HOME = new URL('./', SCOPE).href;
const APP_SCRIPT = new URL('app.js?v=9', SCOPE).href;
const ASSETS = [
  HOME,
  new URL('manifest.json', SCOPE).href,
  APP_SCRIPT
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

function normalizeIndexHtml(html) {
  return html
    .replace('<base target="_top">', '<base href="./" target="_top">')
    .replace(/<base\s+target=["']_blank["']\s*\/?>/i, '')
    .replace('href="/manifest.json"', 'href="manifest.json"')
    .replace("navigator.serviceWorker.register('/sw.js')", "navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './' })")
    .replace(
      '.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; } 28px; text-align: center; }',
      '.auth-container .auth-sub { color: var(--slate-400); font-size: 13px; margin-bottom: 24px; text-align: center; line-height: 1.5; }'
    );
}

async function prepareHtml(response) {
  if (!response) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = normalizeIndexHtml(await response.text());
  if (!html.includes('app.js')) {
    html = html.replace(/<\/body>/i, `<script src="${APP_SCRIPT}" defer></script></body>`);
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(prepareHtml)
        .catch(async () => prepareHtml(await caches.match(HOME)))
    );
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