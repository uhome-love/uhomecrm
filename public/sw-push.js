// Push notification event handlers for service worker
// This file is imported by the VitePWA-generated service worker

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/icon-192x192.png",
      vibrate: [300, 100, 300, 100, 300],
      data: data.data || {},
      actions: [
        { action: "open", title: "Abrir" },
        { action: "dismiss", title: "Fechar" },
      ],
      tag: data.data?.tag || "uhome-notification",
      renotify: true,
      requireInteraction: true,
      silent: false,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (err) {
    console.error("Push event error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/notificacoes";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
