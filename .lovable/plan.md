
# Item 5 Tier 0 — Page Views (PLANO FINAL com 5 ajustes aprovados)

> Estou em **plan mode** — não posso editar arquivos. Aprove este plano revisado (botão **Implement plan**) para eu executar a ordem abaixo na sequência completa.

## Ajustes incorporados

### Ajuste 1 — `ROUTE_PATTERNS` automático

`src/lib/routePatterns.ts`:

```ts
// Toda rota nova entra automaticamente via pageRegistry.
// Rotas públicas (sem tracking): editar PUBLIC_ROUTES abaixo.

import { ROUTE_TO_TAB } from "@/config/pageRegistry";

export const PUBLIC_ROUTES: string[] = [
  "/auth", "/welcome", "/privacidade", "/casatua",
  "/oauth/google/callback", "/wa",
  "/visita/:token", "/indica/:codigo", "/vitrine/:id", "/imovel/:codigo",
];

// Dinâmicas declaradas no pageRegistry.DYNAMIC_PATTERNS
const DYNAMIC: string[] = [
  "/academia/trilha/:trilhaId",
  "/academia/aula/:aulaId",
  // + adicionar manualmente as que existem em App.tsx fora do registry
  // (varredura inicial será feita no execute, lista final reportada em F)
];

export const ROUTE_PATTERNS: string[] = [
  ...Object.keys(ROUTE_TO_TAB),
  ...DYNAMIC,
  ...PUBLIC_ROUTES,
];

export function matchRoutePattern(path: string): string {
  // ordena por especificidade (mais segmentos / menos :param primeiro)
  const sorted = [...ROUTE_PATTERNS].sort((a, b) => {
    const segDiff = b.split("/").length - a.split("/").length;
    if (segDiff !== 0) return segDiff;
    return (a.match(/:/g)?.length ?? 0) - (b.match(/:/g)?.length ?? 0);
  });
  for (const p of sorted) {
    const re = new RegExp("^" + p.replace(/:[^/]+/g, "[^/]+") + "$");
    if (re.test(path)) return p;
  }
  return "/_unknown";
}

export function isPublicRoute(pattern: string): boolean {
  return PUBLIC_ROUTES.includes(pattern);
}
```

Esperado no execute: ~95–105 patterns. Reportarei em **F**.

### Ajuste 2 — `REFRESH MATERIALIZED VIEW CONCURRENTLY` fora de PLPGSQL

`REFRESH CONCURRENTLY` **não pode rodar dentro de bloco transacional** (PLPGSQL roda tudo em 1 tx). Solução: **não usar function**, registrar 3 statements diretos no `cron.schedule`:

```sql
SELECT cron.schedule(
  'page-views-retention-daily',
  '0 6 * * *',  -- 06:00 UTC = 03:00 BRT
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.page_views_daily;
    DELETE FROM public.page_views WHERE viewed_at < now() - interval '90 days';
    DELETE FROM public.page_views_daily WHERE dia_brt < (now() - interval '365 days')::date;
  $$
);
```

`pg_cron` executa cada statement em sua própria transação. Reportarei em **E** a abordagem final usada.

### Ajuste 3 — `navigator.sendBeacon` + RPC `flush_page_views`

Migration 2 cria RPC:

```sql
CREATE OR REPLACE FUNCTION public.flush_page_views(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updates jsonb := COALESCE(payload->'updates', '[]'::jsonb);
  v_inserts jsonb := COALESCE(payload->'inserts', '[]'::jsonb);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  -- Updates de duration_ms (só linhas do próprio usuário)
  UPDATE public.page_views pv
     SET duration_ms = (u->>'duration_ms')::int
    FROM jsonb_array_elements(v_updates) u
   WHERE pv.id = (u->>'id')::uuid
     AND pv.user_id = v_uid;

  -- Inserts (força user_id = caller)
  INSERT INTO public.page_views
    (user_id, role, route, route_pattern, referrer_route,
     session_id, duration_ms, viewport_width, viewed_at)
  SELECT v_uid,
         i->>'role', i->>'route', i->>'route_pattern', i->>'referrer_route',
         i->>'session_id', NULLIF(i->>'duration_ms','')::int,
         NULLIF(i->>'viewport_width','')::int,
         COALESCE((i->>'viewed_at')::timestamptz, now())
    FROM jsonb_array_elements(v_inserts) i;
END $$;

REVOKE ALL ON FUNCTION public.flush_page_views(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flush_page_views(jsonb) TO authenticated;
```

No hook:

```ts
const beaconFlush = () => {
  if (!queue.length && !pendingDurationUpdate) return;
  const url = `${SUPABASE_URL}/rest/v1/rpc/flush_page_views`;
  const body = JSON.stringify({ payload: { updates: [...], inserts: [...] } });
  const blob = new Blob([body], { type: "application/json" });
  // sendBeacon não permite headers custom → usar fetch keepalive como fallback
  const ok = navigator.sendBeacon(url, blob);
  if (!ok) {
    fetch(url, {
      method: "POST", keepalive: true, body,
      headers: { "Content-Type":"application/json", apikey: ANON, Authorization: `Bearer ${token}` },
    });
  }
};
window.addEventListener("beforeunload", beaconFlush);
document.addEventListener("visibilitychange", () => { if (document.visibilityState==="hidden") beaconFlush(); });
```

Como `sendBeacon` não envia Authorization, na prática o flush definitivo será via `fetch(..., {keepalive:true})` com o JWT. Reportarei resultado em **C.g** (smoke: matar aba e ver linha com `duration_ms` preenchido).

### Ajuste 4 — Alerta `/_unknown > 1%`

`SidebarUso.tsx` recebe `unknownPct` da query KPI e renderiza:

```tsx
{unknownPct > 1 && (
  <Card className="border-yellow-500/40 bg-yellow-500/5">
    <CardContent className="pt-4 text-sm">
      ⚠️ {unknownCount} visitas a rotas não mapeadas ({unknownPct.toFixed(1)}%).
      Atualize <code>src/lib/routePatterns.ts</code>.
    </CardContent>
  </Card>
)}
```

### Ajuste 5 — Documentar semântica de "session"

Topo de `usePageTracking.ts`:
```ts
/**
 * Session = aba do navegador (sessionStorage scope).
 * Um usuário com 3 abas conta 3 sessions distintos.
 * Reload na mesma aba mantém o session_id; fechar/abrir aba cria novo.
 */
```

KPI card "Sessions" recebe `<TooltipProvider>` com o mesmo texto.

---

## Ordem de execução

1. **Migration 1** — `page_views` tabela + 5 índices + 4 policies RLS
2. **Migration 2** — MV `page_views_daily` (com índice UNIQUE p/ CONCURRENTLY) + RPCs `get_page_views_stats`, `get_page_views_table`, `flush_page_views`
3. **`supabase--insert`** — `cron.schedule(...)` com os 3 statements (Ajuste 2)
4. **Frontend**:
   - `src/lib/routePatterns.ts` + `src/test/routePatterns.test.ts`
   - `src/hooks/usePageTracking.ts` + `src/components/PageTrackingProvider.tsx`
   - `src/hooks/useUsoPaginasStats.ts`
   - `src/pages/admin/UsoPaginasPanel.tsx`
   - `src/components/admin/uso-paginas/{KpiCardsUso,TabelaRotas,SidebarUso}.tsx`
   - `src/App.tsx` (rota + wrap provider) e `src/components/layout/Sidebar.tsx`
5. **Smoke tests (a–g)** descritos no seu prompt + report A–F.

## Retorno após execução

A. Hashes (2 migrations + 1 commit frontend)
B. Screenshot `/admin/uso-paginas` após navegação
C. Output smoke a–g
D. Confirmação dos 5 ajustes
E. Abordagem final do `REFRESH CONCURRENTLY` (esperado: direto no `cron.schedule`)
F. Total de patterns detectados em `ROUTE_PATTERNS`

**Aguardando clique em "Implement plan" para executar.**
