/* SIM-SPPG service worker
 * Network-first for navigation and JavaScript bundles.
 * Backend and Supabase requests are never cached.
 */
const CACHE_VERSION = 'sim-sppg-v20260720-approval-state-fix2';
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

function networkFirst(request, cacheKey) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(cacheKey || request, copy));
      }
      return response;
    })
    .catch(() => caches.match(cacheKey || request));
}

/*
 * Patch compatibility issues in older app.js bundles without changing their
 * large generated source directly. The global state is initialized immediately,
 * then the small UI compatibility bundle is loaded.
 */
function networkFirstAppWithCompatibility(request) {
  return fetch(request)
    .then(async (response) => {
      if (!response || !response.ok) return response;
      const source = await response.text();
      const bootstrap = `
;(() => {
  if (typeof window.currentTrxId === 'undefined') window.currentTrxId = null;
  if (window.__simSppgApprovalUiLoader) return;
  window.__simSppgApprovalUiLoader = true;
  const load = () => {
    const script = document.createElement('script');
    script.src = './uiux-fixes.js?v=20260720-approval-state-fix2';
    script.defer = true;
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
`;
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/javascript; charset=utf-8');
      headers.delete('Content-Length');
      headers.delete('Content-Encoding');
      const patched = new Response(source + bootstrap, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      const copy = patched.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      return patched;
    })
    .catch(() => caches.match(request));
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

  if (url.origin === self.location.origin && url.pathname.endsWith('/app.js')) {
    event.respondWith(networkFirstAppWithCompatibility(request));
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