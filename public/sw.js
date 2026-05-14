// UhomeSales Service Worker — kill-switch + push runtime
// Não cacheia HTML/JS do app. Toda ativação limpa caches antigos e força
// reload das abas abertas com cache-bust, garantindo que ninguém fique
// preso a um bundle vencido após deploy.

const SW_VERSION = "2026-05-14T23:55Z-killswitch";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch {}

      // 1. Apaga TODOS os caches (workbox antigo, runtime, vite-plugin-pwa, etc.)
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n).catch(() => {})));
        if (names.length) console.log(`[SW] purged ${names.length} cache(s)`);
      } catch (err) {
        console.warn("[SW] cache purge failed", err);
      }

      // 2. Notifica abas e força reload com cache-bust
      try {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          try {
            client.postMessage({ type: "SW_ACTIVATED", version: SW_VERSION });
          } catch {}
          try {
            const url = new URL(client.url);
            // Só recarrega se ainda não carregou via cache-bust nesta versão
            if (url.searchParams.get("_swv") !== SW_VERSION) {
              url.searchParams.set("_swv", SW_VERSION);
              await client.navigate(url.toString()).catch(() => {});
            }
          } catch {}
        }
      } catch (err) {
        console.warn("[SW] client reload failed", err);
      }

      console.log(`[SW] activated version=${SW_VERSION}`);
    })()
  );
});

// Fetch passthrough (sem cache) — garante que nunca servimos HTML/JS antigo.
// Necessário declarar pelo menos um handler para o SW ser considerado válido.
self.addEventListener("fetch", () => {
  // No-op: deixa o browser fazer a request normalmente.
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
