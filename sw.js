const CACHE = "simsppg-v4";
const APP_SCOPE = self.registration.scope;
const APP_URL = new URL("./", APP_SCOPE).href;
const ENHANCEMENT_URL = new URL("notification-enhancement.js?v=4", APP_SCOPE).href;
const ASSETS = [APP_URL, ENHANCEMENT_URL];

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

function enhanceHtml(response) {
  if (!response) return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return response.text().then((html) => {
    if (!html.includes("notification-enhancement.js")) {
      html = html.replace(/<\/body>/i, `<script src="${ENHANCEMENT_URL}" defer></script></body>`);
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(enhanceHtml)
        .catch(async () => enhanceHtml(await caches.match(event.request) || await caches.match(APP_URL)))
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
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
