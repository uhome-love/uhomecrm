// UhomeSales Service Worker — KILL SWITCH
// Estratégia: este SW NÃO faz mais cache nenhum. Ele existe apenas para
// limpar todo cache antigo, desregistrar workers presos e forçar reload
// limpo dos clientes que estão com bundle/JS/HTML obsoleto.
//
// Por que: corretores estavam presos em build antiga (login que não entra,
// pipeline que não carrega). Mantemos este SW publicado por pelo menos 1
// ciclo para garantir que TODOS os dispositivos sejam recuperados.

self.addEventListener("install", (e) => {
  // Ativa imediatamente, sem esperar abas fecharem
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      try {
        // 1) Apaga TODOS os caches antigos (shell, imagens, workbox, qualquer um)
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch {}

      try {
        // 2) Toma controle de todas as abas abertas
        await self.clients.claim();
      } catch {}

      try {
        // 3) Manda cada aba recarregar com cache-bust para baixar bundle novo
        const all = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          all.map((c) => {
            try {
              const url = new URL(c.url);
              url.searchParams.set("_cc", Date.now().toString());
              return c.navigate(url.toString());
            } catch {
              return null;
            }
          }),
        );
      } catch {}

      try {
        // 4) Desregistra a si mesmo — não queremos mais SW gerenciando o app
        await self.registration.unregister();
      } catch {}
    })(),
  );
});

// Não interceptamos fetch — todas as requisições passam direto para a rede.
// Isso garante que ninguém sirva HTML/JS/manifest antigo.

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
