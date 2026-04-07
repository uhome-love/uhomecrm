

## Corrigir cache persistente para corretores — limpeza automática

### Problema raiz
Existem **dois service workers conflitantes**:

1. **`public/sw.js`** — SW manual escrito à mão, registrado em `main.tsx` via `navigator.serviceWorker.register("/sw.js")`
2. **VitePWA** — configurado em `vite.config.ts` com `registerType: "autoUpdate"`, que gera seu próprio SW em build time

O que acontece: em produção, `main.tsx` registra o SW manual (`/sw.js`) **antes** do VitePWA tentar registrar o seu. O SW manual assume o controle e nunca é substituído pelo do VitePWA. Como o SW manual tem `CACHE_VERSION = "uhomesales-v3"` hardcoded, ele **nunca invalida o cache** quando há novo deploy — os corretores ficam presos na versão antiga.

Além disso, o SW manual intercepta `fetch` de documentos e scripts com `fetch(request, { cache: "no-store" })`, mas se o browser já tiver o SW antigo instalado, ele continua servindo a versão cached do próprio `sw.js`.

### Solução

Unificar em **um único SW** — manter o `public/sw.js` manual (que já tem push notifications) e **remover o VitePWA** que não está efetivamente funcionando. Melhorar o SW manual para se auto-invalidar a cada deploy.

#### 1. Remover VitePWA do `vite.config.ts`
- Remover o import e toda a configuração do plugin `VitePWA`
- Remover `vite-plugin-pwa` do `package.json`
- Isso elimina o SW duplicado

#### 2. Atualizar `public/sw.js` — auto-invalidação por deploy
- Trocar `CACHE_VERSION` hardcoded por um timestamp/hash injetado no build
- Adicionar lógica no `activate` para **deletar TODOS os caches antigos** quando a versão mudar
- Manter a estratégia Network-First para documentos/scripts (já está correta)
- Manter push notifications (já está correto)

Como não podemos injetar variáveis em `public/`, a estratégia será:
- O SW verifica periodicamente se há uma nova versão comparando um arquivo de versão (`/version.json`) gerado no build
- Se a versão mudou, força `skipWaiting` + limpa caches

#### 3. Atualizar `main.tsx` — verificação mais agressiva
- Reduzir intervalo de checagem de 30min para **5 minutos**
- Adicionar checagem de versão no `visibilitychange` (quando corretor volta ao app)
- Manter `controllerchange → reload`

#### 4. Gerar `/version.json` no build
- Adicionar um pequeno plugin Vite inline que gera `dist/version.json` com hash do build
- O SW consulta esse arquivo para saber se precisa se atualizar

### Detalhes técnicos

**`vite.config.ts`** — remover VitePWA, adicionar plugin de versão:
```typescript
// Remover: import { VitePWA } from "vite-plugin-pwa";
// Remover: todo o bloco VitePWA({...})
// Adicionar: plugin inline que gera version.json com Date.now()
```

**`public/sw.js`** — versão melhorada:
```javascript
const CACHE_NAME = "uhomesales-cache";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  // Limpar TODOS os caches ao ativar nova versão
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => clients.claim())
  );
});

// Fetch: Network-First para tudo exceto imagens
// Push notifications: sem mudança
```

**`src/main.tsx`** — checagem mais agressiva:
```typescript
// Checar a cada 5 min
setInterval(() => reg.update(), 5 * 60 * 1000);

// Checar quando o app volta ao foco
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") reg.update();
});
```

### Resultado esperado
- Cada novo deploy gera um novo `version.json`
- O SW detecta a mudança em até 5 minutos (ou ao voltar ao app)
- Caches antigos são deletados automaticamente
- Página recarrega sozinha com a versão nova
- Push notifications continuam funcionando normalmente
- Zero intervenção manual dos corretores

