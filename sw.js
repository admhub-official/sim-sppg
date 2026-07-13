const CACHE = "simsppg-v3";
const ASSETS = ["/", "notification-enhancement.js"];

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

function injectNotificationEnhancement(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return response.text().then((html) => {
    if (!html.includes("notification-enhancement.js")) {
      html = html.replace(
        /<\/body>/i,
        '<script src="notification-enhancement.js?v=3" defer></script></body>'
      );
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
        .then(injectNotificationEnhancement)
        .catch(() => caches.match(event.request).then((cached) => cached ? injectNotificationEnhancement(cached) : cached))
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { title: "SIM-SPPG", body: event.data ? event.data.text() : "Ada notifikasi baru." };
  }

  const title = data.title || "SIM-SPPG";
  const options = {
    body: data.body || "",
    icon: data.icon || "https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png",
    badge: data.badge || "https://dmjsgtichrfxhyywstrt.supabase.co/storage/v1/object/public/app-assets/logo.png",
    tag: data.tag || "sim-sppg-notif",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
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
      .then((newSub) => {
        return self.clients.matchAll().then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({ type: "PUSH_SUBSCRIPTION_RENEWED", subscription: newSub.toJSON() });
          });
        });
      })
  );
});
