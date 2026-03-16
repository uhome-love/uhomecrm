const CACHE_NAME = "uhomesales-runtime-v2";
const STATIC_DESTINATIONS = new Set(["script", "style", "document", "worker"]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => caches.delete(n)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/~oauth")) return;
  if (url.hostname.includes("supabase")) return;

  // Never cache app shell/assets that can leave the published UI stale
  if (STATIC_DESTINATIONS.has(e.request.destination)) {
    e.respondWith(fetch(e.request, { cache: "no-store" }));
    return;
  }

  // Cache only lightweight same-origin GETs as offline fallback
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin && e.request.destination === "image") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push notifications
self.addEventListener("push", (e) => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    const options = {
      body: data.body || "Nova notificação UhomeSales",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate: [300, 100, 300, 100, 300],
      data: { url: data.url || "/" },
      actions: data.actions || [
        { action: "open", title: "Abrir" },
        { action: "dismiss", title: "Fechar" },
      ],
      tag: data.data?.tag || "uhome-notification",
      renotify: true,
      requireInteraction: true,
      silent: false,
    };
    e.waitUntil(self.registration.showNotification(data.title || "UhomeSales", options));
  } catch (err) {
    console.error("Push event error:", err);
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Listen for skip waiting message from the app
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
