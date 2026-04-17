// UhomeSales Service Worker — Resilient PWA
// Strategy: Stale-While-Revalidate for app shell so the app ALWAYS opens,
// even on flaky 4G or when launched from the home screen offline.

const APP_SHELL_CACHE = "uhomesales-shell-v2";
const IMAGE_CACHE = "uhomesales-images-v2";

let _currentVersion = null;

self.addEventListener("install", (e) => {
  // Pre-cache the app entry so PWA always opens
  e.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll(["/", "/index.html", "/manifest.json"]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Remove old caches but KEEP the current shell cache (so PWA still opens offline)
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== APP_SHELL_CACHE && n !== IMAGE_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/~oauth")) return;
  if (url.hostname.includes("supabase")) return;

  const dest = e.request.destination;

  // ── Documents (HTML / navigation): Network-First with cache fallback ──
  // Critical: if offline or slow, serve cached shell so PWA always opens
  if (dest === "document" || e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Network failed → try cache, then fallback to root
          const cached = await caches.match(e.request);
          if (cached) return cached;
          const root = await caches.match("/");
          if (root) return root;
          const indexHtml = await caches.match("/index.html");
          if (indexHtml) return indexHtml;
          return new Response("Sem conexão", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  // ── Scripts / Styles: Stale-While-Revalidate ──
  // Serve from cache instantly (fast PWA boot), update in background
  if (dest === "script" || dest === "style" || dest === "worker") {
    e.respondWith(
      caches.open(APP_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const networkPromise = fetch(e.request)
          .then((response) => {
            if (response.ok) cache.put(e.request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // ── Images: cache as offline fallback ──
  if (dest === "image" && url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
});

// ── Version check: detect new deploys and force update ──
async function checkForUpdate() {
  try {
    const res = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (_currentVersion === null) {
      _currentVersion = data.v;
      return;
    }
    if (data.v !== _currentVersion) {
      _currentVersion = data.v;
      // New deploy → clear shell cache so next nav fetches fresh
      await caches.delete(APP_SHELL_CACHE);
      const allClients = await clients.matchAll({ type: "window" });
      allClients.forEach((client) => client.navigate(client.url));
    }
  } catch {
    // Ignore — never break the app due to version check failure
  }
}

setInterval(checkForUpdate, 5 * 60 * 1000);

// ── Push Notifications ──
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

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
