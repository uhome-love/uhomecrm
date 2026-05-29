# Plan — Central v2: Admin "Todas as equipes" + 4 mismatches

## Resultado dos GATES (pré-execução)

- **GATE 1+2 ✅** — `SELECT COUNT(*), gerente_id IS NULL FROM team_members WHERE status='ativo' GROUP BY 2` → **29 ativos, todos com gerente_id** (`sem_gestor=false`). Zero corretores ativos sem gestor. A lógica "todas equipes" via `gerente_id IS NOT NULL` cobre todos. Sem decisão pendente.
- **GATE 3 ✅** — `get_ranking_central` tem o mesmo padrão de montagem de `v_team_auth`. Incluída nas 6 RPCs alteradas.
- Nomes canônicos confirmados em `_kpi_team_window_core`: `ativos_no_pipeline`, `negocios_da_oa`, `taxa_comparecimento_pct` (sob `visitas`), `caidos` (sob `negocios`).

## ETAPA 1 — Migration E (CREATE OR REPLACE em 6 RPCs)

Em **cada** RPC, substituir o bloco de autorização + montagem de `v_team_auth` por:

```sql
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

IF p_gestor_id IS NULL THEN
  -- admin only: todas as equipes
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_team_auth := ARRAY(
    SELECT DISTINCT user_id FROM team_members
    WHERE status='ativo' AND gerente_id IS NOT NULL
  ) || ARRAY(
    SELECT DISTINCT gerente_id FROM team_members
    WHERE status='ativo' AND gerente_id IS NOT NULL
  );
ELSE
  IF auth.uid() <> p_gestor_id AND NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_team_auth := ARRAY(SELECT user_id FROM team_members
                       WHERE gerente_id=p_gestor_id AND status='ativo')
                 || ARRAY[p_gestor_id];
END IF;

v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));
```

RPCs afetadas (assinatura e corpo CORE/EXTRAS mantidos, só muda o cabeçalho acima):
1. `get_relatorio_pipeline_leads`
2. `get_relatorio_oferta_ativa`
3. `get_relatorio_visitas`
4. `get_relatorio_negocios`
5. `get_relatorio_vendas`
6. `get_ranking_central` (sem `p_prev_*`; mesmo bloco)

Notas técnicas:
- `ANY(ARRAY[])` vazio é seguro (não quebra; só retorna zero linhas) — mas como GATE confirma 29 membros, o array nunca virá vazio para admin.
- `get_ranking_central` admin-all listará todos os corretores de todas as equipes ordenados por VGV (~29 linhas). Aceito.
- Todas permanecem `STABLE SECURITY DEFINER SET search_path TO 'public'`.

### Validação esperada (pós-migration)
- admin Lucas + `p_gestor_id=NULL` + Maio/2026 → `vendas.vgv` >> R$ 925k (soma Gabrielle + Bruno + Gabriel); retorna sucesso (não forbidden).
- gestor (não-admin) + `p_gestor_id=NULL` → `forbidden`.
- (Nota: o test call direto via read_query roda com `auth.uid()=NULL` → `unauthorized`; a validação real é feita no preview logado como admin.)

## ETAPA 2 — 4 mismatches no frontend

- `src/components/central-v2/sections/SectionOA.tsx`
  - `oferta_ativa.ativos_pipeline` → `oferta_ativa.ativos_no_pipeline`
  - `oferta_ativa.negocios_oa` → `oferta_ativa.negocios_da_oa`
- `src/components/central-v2/sections/SectionVisitas.tsx`
  - `visitas.taxa_comparecimento` → `visitas.taxa_comparecimento_pct`
- `src/components/central-v2/sections/SectionNegocios.tsx`
  - `negocios.cairam` → `negocios.caidos`

Pós-aplicação: Console DEV sem warnings `[Central v2] Missing field`.

## ETAPA 3 — Hook useRelatoriosCentral.ts

Alterar resolução de `gestorId` para distinguir "admin sem equipe" (NULL real) de "não autenticado":

```ts
const gestorId = useMemo<string | null | undefined>(() => {
  if (!user?.id) return null;          // não autenticado → bloqueia query
  if (isAdmin) return filters.equipe ?? undefined; // admin sem equipe → undefined = todas
  return user.id;                      // gestor → próprio id
}, [user?.id, isAdmin, filters.equipe]);
```

- `enabled` das 5 queries: `gestorId !== null` (permite `undefined` para admin-all; bloqueia só quando `null`).
- `fetchRpc` recebe `gestorId` e envia `p_gestor_id: gestorId ?? null` no payload.
- `queryKey`: incluir um token estável para `undefined` (ex.: `gestorId ?? 'ALL'`) para não colidir cache.
- Ajustar assinatura de `fetchRpc` para aceitar `string | undefined`.
- Mesmo ajuste em `useRelatorioIndividual` (placeholder do Prompt 7) para consistência.

## Sequência de execução (após aprovação)
1. Migration E (6 RPCs) — aguardar aprovação do usuário no diálogo de migration.
2. Aplicar 4 mismatches + hook.
3. Build limpo + verificar console sem warnings no preview logado como admin.

Nenhuma alteração feita ainda — aguardando aprovação.