## Kill switch de Service Worker — execução única por usuário

### Causa
~30 corretores ainda têm SW antigo registrado (pré-correção do lock). Primeira carga falha com `ERR_NAME_NOT_RESOLVED` até o SW velho expirar. Precisa de limpeza one-shot automática.

### Arquivos

**1. Criar `src/lib/swKillSwitch.ts`** (novo)

Função `runKillSwitch()` idempotente, controlada por flag `localStorage["uhome:sw:killswitch:v1"]`:
- Se flag = `"done"` → retorna imediatamente (linha 1).
- Senão:
  1. `navigator.serviceWorker.getRegistrations()` → `unregister()` em todos.
  2. `caches.keys()` → `caches.delete()` em todos.
  3. `indexedDB.databases()` → filtra por nome contendo `supabase`/`uhome`/`sb-` e `deleteDatabase()`.
  4. `localStorage.setItem(KILL_SWITCH_KEY, "done")`.
  5. `window.location.reload()` uma vez.
- Catch global: marca `"done"` mesmo em erro para não loopar.

**2. Editar `src/main.tsx`**

Adicionar como **primeiras duas linhas** (antes de `import "./lib/originalFetch"`):
```ts
import { runKillSwitch } from "./lib/swKillSwitch";
runKillSwitch();
```
`originalFetch` permanece logo em seguida. Resto do arquivo intacto.

### O que NÃO mexer
`customClient.ts`, `networkTelemetry.ts`, `originalFetch.ts`, `proxyEndpoints.ts`, `fetchCircuitBreaker.ts`, `useAuth.tsx`, hooks, RLS, RPCs, design tokens, `public/sw.js`.

### Critério de aceite
- Build TS verde.
- Primeira carga no published: SW velho desregistrado, caches/IDB limpos, flag marcada, reload único, app funciona.
- Cargas subsequentes: retorno instantâneo.

### Reversibilidade
DevTools: `localStorage.removeItem("uhome:sw:killswitch:v1"); location.reload()`.

### Anti-loop
Se build quebrar 2x, paro e reporto erro literal.
