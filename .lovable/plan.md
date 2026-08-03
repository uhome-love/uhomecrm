# Lote 4a — Unificar a definição de VGV assinado

Definição única: `fase='ganho' AND status='ativo' AND data_assinatura BETWEEN período`.

## Fato medido no banco (leitura, hoje)

| fase | status | negócios com `data_assinatura` | VGV |
|---|---|---|---|
| ganho | ativo | 86 | R$ 51.175.014,19 |
| ganho | arquivado | 5 | R$ 2.232.630,00 |

Nenhum negócio fora de `fase='ganho'` tem `data_assinatura` preenchida. Logo:
- acrescentar `fase='ganho'` onde falta **não muda número nenhum hoje** (é blindagem contra dado futuro);
- acrescentar `status='ativo'` **remove 5 negócios / R$ 2.232.630** do histórico total. Por mês: junho/2026 −1 venda / −R$ 410.000; julho/2026 −0. Os outros 4 são anteriores a junho.
- Não há `status='perdido'` com `data_assinatura`.

## (a) SQL por RPC

Formato: para cada função, o bloco alterado exato. O `CREATE OR REPLACE` a aplicar é **byte-idêntico ao `pg_get_functiondef` atual** exceto pelas linhas marcadas — nada mais de assinatura, `SECURITY DEFINER`, `search_path`, autorização ou demais CTEs muda. Nenhuma função troca de assinatura, então não há `DROP FUNCTION`.

### 1. `_kpi_team_window_core(uuid[], uuid[], date, date, date, date, boolean)`

Três pontos, todos no bloco de vendas:

```sql
-- ramo p_include_partner_split = TRUE, CTE base:
      WHERE n.fase = 'ganho' AND n.status = 'ativo'   -- << MUDA (era só fase='ganho')
        AND n.data_assinatura BETWEEN p_start AND p_end

-- ramo ELSE (sem split):
    SELECT COALESCE(SUM(COALESCE(vgv_final, vgv_estimado, 0)), 0), count(*)::int
      INTO v_vgv, v_vendas_qtd
    FROM negocios
    WHERE corretor_id = ANY(p_team_prof)
      AND fase = 'ganho' AND status = 'ativo'         -- << MUDA
      AND data_assinatura BETWEEN p_start AND p_end;

-- período anterior (v_vgv_prev):
    FROM negocios
    WHERE corretor_id = ANY(p_team_prof)
      AND fase = 'ganho' AND status = 'ativo'         -- << MUDA
      AND data_assinatura BETWEEN p_prev_start AND p_prev_end;
```

Efeito colateral desejado: `vendas.ticket_medio` e `vendas.delta_pct` passam a usar a base correta. Nada de `leads`, `visitas`, `negocios` ou `oferta_ativa` é tocado.

### 2. `rpc_perf_dashboard(date, date)` — CTE `vgv`

```sql
  WITH vgv AS (
    SELECT n.corretor_id AS profile_id,
           COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0) AS vgv_vendido,
           COUNT(*) AS qtd_ganho
      FROM public.negocios n
     WHERE n.fase = 'ganho'
       AND n.status = 'ativo'                          -- << LINHA NOVA
       AND n.data_assinatura BETWEEN p_inicio AND p_fim
     GROUP BY 1
  ), ...
```

A CTE `fases` (`qtd_contrato`/`qtd_negociacao`) já filtra `status='ativo'` — fica intacta. O diagnóstico `vgv_zerado` passa a considerar arquivado como não-venda (correto).

### 3. `get_relatorio_vendas(uuid, date, date, date, date)` — 4 agregações

O headline vem de `_kpi_team_window_core` (corrigido no item 1). As quebras locais:

```sql
-- por_empreendimento
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND fase = 'ganho' AND status = 'ativo'          -- << LINHA NOVA
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1 ORDER BY vgv DESC NULLS LAST LIMIT 10

-- por_dia
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND fase = 'ganho' AND status = 'ativo'          -- << LINHA NOVA
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1

-- comissao_real
  FROM negocios n
  JOIN pipeline_comissoes pc ON pc.pipeline_lead_id = n.pipeline_lead_id
                            AND pc.corretor_id = n.corretor_id
  WHERE n.corretor_id = ANY(v_team_prof)
    AND n.fase = 'ganho' AND n.status = 'ativo'        -- << LINHA NOVA
    AND n.data_assinatura BETWEEN p_start AND p_end;

-- comissao_fallback
  FROM negocios n
  WHERE n.corretor_id = ANY(v_team_prof)
    AND n.fase = 'ganho' AND n.status = 'ativo'        -- << LINHA NOVA
    AND n.data_assinatura BETWEEN p_start AND p_end
    AND NOT EXISTS (...)
```

### 4. `get_dashboard_gerente(uuid, text)` — 3 CTEs

```sql
  vendas_atual AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n JOIN prof p ON p.profile_id = n.corretor_id
    WHERE n.fase = 'ganho' AND n.status = 'ativo'      -- << LINHA NOVA
      AND n.data_assinatura BETWEEN v_p_start AND v_p_end
  ),
  vendas_prev AS (
    ... WHERE n.fase = 'ganho' AND n.status = 'ativo'  -- << LINHA NOVA
      AND n.data_assinatura BETWEEN v_prev_start AND v_prev_end
  ),
  -- segundo bloco WITH (ranking de corretores):
  vendas_c AS (
    SELECT p.auth_id, COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS vgv
    FROM prof p
    LEFT JOIN negocios n ON n.corretor_id = p.profile_id
     AND n.fase = 'ganho' AND n.status = 'ativo'       -- << LINHA NOVA (no ON, para preservar o LEFT JOIN)
     AND n.data_assinatura BETWEEN v_p_start AND v_p_end
    GROUP BY p.auth_id
  ),
```

Importante: em `vendas_c` a condição entra no `ON`, nunca num `WHERE` — senão corretores sem venda somem do ranking.

### 5. `get_dashboard_gerente_v4_kpis(uuid, text)` — 2 CTEs

```sql
  vendas_atual AS (SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.fase = 'ganho' AND n.status = 'ativo'      -- << LINHA NOVA
      AND n.data_assinatura BETWEEN v_p_start AND v_p_end),
  vendas_prev AS (... AND n.fase = 'ganho' AND n.status = 'ativo'   -- << LINHA NOVA
      AND n.data_assinatura BETWEEN v_prev_start AND v_prev_end),
```

### 6. `get_ranking_central(uuid, date, date)` — CTE `vendas`

```sql
  vendas AS (
    SELECT corretor_id AS profile_id,
           COUNT(*)::int AS qtd_vendas,
           SUM(COALESCE(vgv_final,vgv_estimado))::numeric AS vgv
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND fase = 'ganho' AND status = 'ativo'          -- << LINHA NOVA
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1
  ),
```

Aqui é `LEFT JOIN vendas v` na montagem final, então corretores sem venda continuam aparecendo com `COALESCE(...,0)`.

## (b) Migrations

Cabe em **1 única migration**: são 6 `CREATE OR REPLACE FUNCTION` puros, sem DDL de tabela, sem alteração de assinatura, sem dependências entre si (`get_relatorio_vendas` só chama `_kpi_team_window_core` em runtime). Um único reload do PostgREST. Fica dentro do limite de 2/dia.

## (c) Frontend — `src/hooks/useCeoDashboard.ts`

Linha 510, query `allNeg`:

```diff
- supabase.from("negocios").select("id, fase, vgv_estimado, vgv_final, auth_user_id, data_assinatura")
-   .in("auth_user_id", allMemberUserIds).eq("fase", "ganho")
-   .gte("data_assinatura", range.start).lte("data_assinatura", range.end),
+ supabase.from("negocios").select("id, fase, vgv_estimado, vgv_final, auth_user_id, data_assinatura")
+   .in("auth_user_id", allMemberUserIds).eq("fase", "ganho").eq("status", "ativo")
+   .gte("data_assinatura", range.start).lte("data_assinatura", range.end),
```

Único ponto tocado no arquivo. `allNegAtivos` (propostas em `em_negociacao`/`contrato`) já filtra `status='ativo'` e não muda.

## (d) Rateio de parceria 50/50 — inconsistência (apenas relato, não muda neste lote)

| Call-site | Aplica split de `pipeline_parcerias`? |
|---|---|
| `_kpi_team_window_core` (Central de Relatórios / `get_relatorio_vendas`) | **Sim**, quando chamado com `p_include_partner_split = true` (é o caso do relatório de vendas) |
| `_kpi_team_window_core` com `p_include_partner_split = false` | Não — soma o valor cheio por `corretor_id` |
| `v_vgv_prev` dentro do próprio `_kpi_team_window_core` | **Não** — o período anterior nunca usa split, mesmo quando o atual usa. Isso torna o `delta_pct` de vendas comparável só por aproximação |
| `rpc_perf_dashboard` | Não |
| `get_relatorio_vendas` (quebras `por_empreendimento`, `por_dia`, comissões) | Não — só o headline tem split |
| `get_dashboard_gerente` (v3) | Não |
| `get_dashboard_gerente_v4_kpis` | Não |
| `get_ranking_central` | Não |
| `useCeoDashboard.teamsData` | Não |
| `get_kpis_por_periodo` / `v_kpi_negocios` (referência) | Não |

Consequência atual: em negócio com parceria entre corretores de times diferentes, o ranking soma o valor cheio nos dois lados enquanto o headline do relatório de vendas soma metade. **Não altero nada disso no 4a** — fica como decisão separada (Lote 4b), porque envolve escolher qual comportamento vira o padrão e mexe na regra `mem://rules/business/vgv-fonte-unica-rateio`.

## (e) Matriz de regressão

Comparar, para o **mesmo período** (testar "Este mês", "Mês passado" — que contém o arquivado de junho — e "Últimos 90 dias"):

| # | Onde | Esperado |
|---|---|---|
| 1 | `/ceo` — card VGV Assinado × ranking de equipes × ranking de corretores | Somatório idêntico entre os três |
| 2 | `get_kpis_por_periodo` (referência, não alterada) × cada RPC alterada | Mesmo total de VGV assinado e mesma contagem de vendas |
| 3 | Dashboard do gerente v3 (`get_dashboard_gerente`) | KPI de vendas bate com o total do time no /ceo; ranking de corretores sem ninguém desaparecendo (LEFT JOIN preservado) |
| 4 | Dashboard do gerente v4 (`get_dashboard_gerente_v4_kpis`) | `vendas_vgv`/`vendas_count` iguais aos da v3 no mesmo mês |
| 5 | Central de Relatórios → Vendas | headline = soma de `por_dia` = soma de `por_empreendimento`; comissão recalculada coerente |
| 6 | Performance Hub (`rpc_perf_dashboard`) | `vgv_vendido` por corretor bate com o ranking do /ceo |
| 7 | Ranking Central (`get_ranking_central`) | Mesmo total; corretores zerados continuam listados |
| 8 | KPIs não-vendas | Leads, visitas (criadas/marcadas/realizadas/no-show), negócios ativos, OA e presença **inalterados** em todas as telas |
| 9 | VGV projetado (`vgv_gerado`/`vgv_estimado` por `data_criacao`) | Inalterado |
| 10 | Junho/2026 especificamente | Queda de exatamente 1 venda / R$ 410.000 em todas as telas simultaneamente (era o arquivado) |

Validação ao vivo no preview após o build, tela por tela, antes de declarar pronto.

## (f) Riscos

- **Queda de número esperada e quantificada**: −5 vendas / −R$ 2.232.630 no acumulado histórico; em janelas recentes, apenas junho/2026 muda (−1 / −R$ 410.000). Julho e agosto não mudam. Metas mensais de junho passarão a mostrar atingimento levemente menor — é a correção, não regressão.
- **Consumidor que dependia do comportamento frouxo**: `ceo_metas_mensais` e comparativos históricos já salvos em `executive_reports`/`one_on_one_reports` continuam com o número antigo; relatórios PDF antigos vão divergir do CRM em junho. Não há recálculo retroativo neste lote.
- **`vendas_c` do gerente v3**: se a condição for escrita no `WHERE` em vez do `ON`, corretores sem venda somem do ranking. Risco mitigado pela instrução explícita acima; será conferido no teste 3.
- **`delta_pct` de vendas**: muda junto (período anterior também filtrado) — desejado, mas os percentuais de variação exibidos vão diferir dos de hoje.
- **PostgREST reload**: 1 migration = 1 reload; agendar fora do pico se possível.
- **Baixo risco de quebra estrutural**: nenhuma assinatura, retorno ou chave JSON muda; o frontend não precisa de ajuste além do item (c).
