const CACHE_NAME = "uhomesales-v1";
const urlsToCache = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Skip non-GET and Supabase/OAuth requests
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/~oauth")) return;
  if (url.hostname.includes("supabase")) return;

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
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
      vibrate: [200, 100, 200],
      data: { url: data.url || "/" },
      actions: data.actions || [
        { action: "open", title: "Abrir" },
        { action: "dismiss", title: "Fechar" },
      ],
      tag: data.data?.tag || "uhome-notification",
      renotify: true,
      requireInteraction: data.requireInteraction || false,
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
