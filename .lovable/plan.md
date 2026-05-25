## Objetivo
No card "Visitas · Este mês" do Dashboard Gerente v4, trocar a linha secundária `"9 agendadas · meta 60"` por `"46 realizadas de 80 · meta 60"`, onde **80 = total de visitas criadas/marcadas no período** (independente do status atual).

Hoje o número 9 mostra apenas as que ainda estão pendentes (`agendada/marcada/confirmada`), o que confunde — não é o universo total do mês.

## Diagnóstico
- `src/components/dashboard-v4/V4KpisGrid.tsx` (linha 45) renderiza `kpis.visitas_agendadas` rotulado como "agendadas".
- A RPC `get_dashboard_gerente_v4_kpis` (migration `20260525194918_…`) calcula `visitas_agendadas` filtrando por `status IN ('agendada','marcada','confirmada')` no período de `created_at` — por isso só dá 9.
- Não existe hoje um campo "total de visitas criadas no período".

## Mudanças

### 1. Migration (recriar `get_dashboard_gerente_v4_kpis`)
- Adicionar CTE `visitas_total`:
  ```sql
  visitas_total AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
  )
  ```
- Adicionar no JSON de retorno: `'visitas_total', (SELECT qtd FROM visitas_total)`.
- Manter `visitas_agendadas` por compatibilidade (sem mudar lógica).
- Preservar todo o restante da função (período, team auth/prof, alertas top 5, etc.).

### 2. Hook `src/hooks/useDashboardGerenteV4Kpis.ts`
- Adicionar `visitas_total: number;` na interface `KpisTopV4`.

### 3. Card `src/components/dashboard-v4/V4KpisGrid.tsx`
- Linha 44-47: trocar
  ```tsx
  {kpis.visitas_agendadas.toLocaleString("pt-BR")} agendadas
  {meta > 0 && <> · meta {meta.toLocaleString("pt-BR")}</>}
  ```
  por
  ```tsx
  de {kpis.visitas_total.toLocaleString("pt-BR")} no mês
  {meta > 0 && <> · meta {meta.toLocaleString("pt-BR")}</>}
  ```
  Resultado visual: **46** realizadas · `de 80 no mês · meta 60`.

## Fora de escopo
- Lógica dos demais cards (leads, negócios, vendas).
- Painéis de visitas detalhados (V4PanelVisitas).
- Alertas top 5 corretores.

## Validação
- Após apply: card deve exibir `46 realizadas` + `de 80 no mês · meta 60` para Gabrielle no mês corrente.
