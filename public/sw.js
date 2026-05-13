// UhomeSales Service Worker — minimal PWA runtime
// Mantém suporte a push/background sem cachear HTML/JS do app.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return { title: "UhomeSales", body: event.data?.text?.() ?? "Você tem uma nova notificação." };
    }
  })();

  const title = payload?.title || "UhomeSales";
  const options = {
    body: payload?.body || "Você tem uma nova notificação.",
    icon: payload?.icon || "/icons/icon-192x192.png",
    badge: payload?.badge || "/icons/icon-192x192.png",
    tag: payload?.tag || undefined,
    data: {
      url: payload?.url || "/notificacoes",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/notificacoes";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          try {
            client.navigate(targetUrl);
          } catch {}
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
