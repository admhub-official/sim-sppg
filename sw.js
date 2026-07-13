const CACHE = "simsppg-v5";
const APP_SCOPE = self.registration.scope;
const APP_URL = new URL("./", APP_SCOPE).href;
const APP_SOURCE_URL = new URL("app-source.html", APP_SCOPE).href;
const ASSETS = [
  APP_URL,
  APP_SOURCE_URL,
  new URL("manifest.json", APP_SCOPE).href,
  new URL("notification-enhancement.js?v=5", APP_SCOPE).href,
  new URL("supabase-config.js", APP_SCOPE).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheResponse(request, response) {
  if (!response || !response.ok || request.method !== "GET") return response;
  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(APP_SCOPE);
  if (requestUrl.origin !== scopeUrl.origin) return response;

  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheResponse(event.request, response))
        .catch(async () =>
          (await caches.match(event.request, { ignoreSearch: true })) ||
          (await caches.match(APP_URL, { ignoreSearch: true }))
        )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => cacheResponse(event.request, response))
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

function appTarget(value) {
  try {
    return new URL(value || "./", APP_SCOPE).href;
  } catch (error) {
    return APP_URL;
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { title: "SIM-SPPG", body: event.data ? event.data.text() : "Ada notifikasi baru." };
  }

  const options = {
    body: data.body || "Ada aktivitas baru yang perlu diperiksa.",
    icon: data.icon || "https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png",
    badge: data.badge || "https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png",
    tag: data.tag || "sim-sppg-notif",
    data: { url: appTarget(data.url) },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title || "SIM-SPPG", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = appTarget(event.notification.data && event.notification.data.url);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === new URL(APP_SCOPE).origin) {
          if ("navigate" in client && client.url !== targetUrl) await client.navigate(targetUrl);
          if ("focus" in client) return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((newSub) => self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: "PUSH_SUBSCRIPTION_RENEWED", subscription: newSub.toJSON() });
        });
      }))
      .catch((error) => console.error("Gagal memperbarui push subscription:", error))
  );
});
