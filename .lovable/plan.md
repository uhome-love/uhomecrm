## Causa-raiz

`AbortError: Lock broken by another request with the 'steal' option` aparece em `useHomiAlerts`, `fetchKPIs`, `fetchAllRows` etc. Bug conhecido do `supabase-js` em ambientes com múltiplas abas/requests concorrentes (PWA + StrictMode + React Query): o `navigator.locks` interno é "steal-ed" e qualquer request em curso aborta. Resultado: `Failed to fetch` intermitente, falha de KPIs e listas no `/ceo` mesmo com Cloudflare/Worker 200 OK.

## Arquivo confirmado

`src/integrations/supabase/customClient.ts` — único `createClient` do projeto. Trecho atual (linhas 17-30):

```ts
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);
```

## Mudança (única)

Adicionar **uma linha** dentro do bloco `auth: { ... }`:

```ts
auth: {
  storage: localStorage,
  persistSession: true,
  autoRefreshToken: true,
  lock: async (_name, _acquireTimeout, fn) => fn(),
},
```

Efeito: substitui o lock `navigator.locks` por um no-op que apenas executa o callback. Coordenação cross-tab para refresh de token vira no-op (aceitável — `autoRefreshToken` continua, no pior caso duas abas fazem refresh redundante).

## O que NÃO mexer

- `originalFetch.ts`, `networkTelemetry.ts`, `fetchCircuitBreaker.ts`, `proxyEndpoints.ts`
- `useAuth.tsx`
- URLs (`api.uhomesales.com` permanece)
- Hooks, queries, RPCs, RLS, policies
- Nenhum arquivo novo

## Critério de aceite

1. Build TypeScript verde.
2. Após deploy do publicado, navegar `/ceo`, `/pipeline`, listas de leads → **zero** ocorrências de `Lock broken by another request` no console.
3. Dashboard carrega consistente em wifi e 4G.

## Anti-loop

Caminho e trecho já confirmados acima — não há ambiguidade. Se o build quebrar 2x, paro e volto a Plan Mode com o erro literal.
