const CACHE = "simsppg-v2";
const ASSETS = ["/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ============================================================
// PUSH NOTIFICATION — event ini yang tampilkan notifikasi native
// walau app/tab sedang tertutup total.
// ============================================================
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
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

// Saat notifikasi di-klik — fokus/buka tab app dan arahkan ke url terkait
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

// Jika browser otomatis memperbarui subscription (endpoint berubah),
// beritahu halaman utama supaya dikirim ulang ke backend.
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
