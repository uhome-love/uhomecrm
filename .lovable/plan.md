# Lote 4b — Card de visitas do dashboard do gerente (v4)

Trocar a fração incoerente ("18 realizadas de 3") por 6 indicadores independentes vindos de `v_fato_visita`.

## Fato confirmado (leitura do banco, hoje)

- `get_dashboard_gerente_v4_kpis` calcula visitas em 4 CTEs sobre `visitas_unicas`: `visitas_atual` (status `realizada`, eixo `data_visita`), `visitas_prev`, `visitas_agendadas` (eixo `created_at`, status `agendada/marcada/confirmada`) e `visitas_total` (eixo `created_at`, sem status). Numerador e denominador do card usam eixos diferentes — daí a fração invertida.
- Status realmente existentes em `visitas` nos últimos 90 dias: `realizada` (427), `no_show` (406), `marcada` (24). **Não há nenhuma linha `confirmada`, `agendada`, `pendente`, `reagendada` ou `cancelada` no período.** O indicador "Confirmadas" nascerá em 0 — é fiel ao dado, não bug.
- Tipos no período: `lead` (845), `negocio` (11), `visita` (1).
- `v_fato_visita` **não expõe a coluna `tipo`** no SELECT final (ela existe na CTE `base`, mas não é projetada). Ver item (b).

## (a) SQL — `CREATE OR REPLACE FUNCTION get_dashboard_gerente_v4_kpis`

Base: `pg_get_functiondef` atual, byte-idêntico exceto pelas linhas marcadas `<< MUDA`. Assinatura, `SECURITY DEFINER`, `search_path`, autorização, janelas de período, leads, negócios, vendas (4a) e alertas ficam intactos.

```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_kpis(p_gestor_id uuid, p_periodo text DEFAULT 'hoje'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now(); v_today date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_p_start date; v_p_end date; v_prev_start date; v_prev_end date;
  v_mes_key text; v_meta record;
  v_team_auth uuid[]; v_team_prof uuid[]; v_gestor_prof uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_periodo = 'hoje' THEN
    v_p_start := v_today; v_p_end := v_today;
    v_prev_start := v_today - INTERVAL '7 days'; v_prev_end := v_today - INTERVAL '7 days';
  ELSIF p_periodo = 'semana' THEN
    v_p_start := date_trunc('week', v_today)::date;
    v_p_end := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
    v_prev_start := (date_trunc('week', v_today) - INTERVAL '7 days')::date;
    v_prev_end := (date_trunc('week', v_today) - INTERVAL '1 day')::date;
  ELSE
    v_p_start := date_trunc('month', v_today)::date;
    v_p_end := (date_trunc('month', v_today) + INTERVAL '1 month - 1 day')::date;
    v_prev_start := (date_trunc('month', v_today) - INTERVAL '1 month')::date;
    v_prev_end := (date_trunc('month', v_today) - INTERVAL '1 day')::date;
  END IF;
  v_mes_key := to_char(v_today, 'YYYY-MM');
  SELECT array_agg(user_id) INTO v_team_auth FROM public.resolve_managed_brokers(p_gestor_id);
  IF v_team_auth IS NULL THEN v_team_auth := ARRAY[]::uuid[]; END IF;
  SELECT array_agg(id) INTO v_team_prof INTO v_team_prof FROM profiles WHERE user_id = ANY(v_team_auth); -- (linha original: SELECT array_agg(id) INTO v_team_prof FROM profiles WHERE user_id = ANY(v_team_auth);)
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;
  SELECT id INTO v_gestor_prof FROM profiles WHERE user_id = p_gestor_id LIMIT 1;
  SELECT * INTO v_meta FROM ceo_metas_mensais WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1;
  IF v_meta IS NULL THEN v_meta.meta_vgv_assinado := 0; v_meta.meta_leads := 400;
    v_meta.meta_visitas_realizadas := 0; v_meta.meta_negocios := 90; END IF;

  WITH
  vendas_atual AS (SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.fase = 'ganho' AND n.status = 'ativo' AND n.data_assinatura BETWEEN v_p_start AND v_p_end),
  vendas_prev AS (SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.fase = 'ganho' AND n.status = 'ativo' AND n.data_assinatura BETWEEN v_prev_start AND v_prev_end),
  leads_atual AS (SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end),
  leads_prev AS (SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_prev_start AND v_prev_end),

  -- << MUDA: bloco inteiro de visitas passa a vir de v_fato_visita (fonte canônica,
  --    dedup 1 visita/cliente/dia). Substitui visitas_atual / visitas_agendadas / visitas_total.
  vis AS (
    SELECT
      COUNT(*) FILTER (WHERE data_criacao BETWEEN v_p_start AND v_p_end)::int                               AS criadas,
      COUNT(*) FILTER (WHERE status IN ('marcada','reagendada') AND data_visita >= v_today
                         AND data_visita BETWEEN v_p_start AND v_p_end)::int                                AS a_realizar,
      COUNT(*) FILTER (WHERE status = 'confirmada' AND data_visita BETWEEN v_p_start AND v_p_end)::int      AS confirmadas,
      COUNT(*) FILTER (WHERE conta_realizada AND data_visita BETWEEN v_p_start AND v_p_end)::int            AS realizadas,
      COUNT(*) FILTER (WHERE conta_no_show   AND data_visita BETWEEN v_p_start AND v_p_end)::int            AS no_show
    FROM v_fato_visita
    WHERE corretor_auth_id = ANY(v_team_auth)
      AND (data_criacao BETWEEN v_p_start AND v_p_end OR data_visita BETWEEN v_p_start AND v_p_end)
  ),
  vis_prev AS (
    SELECT COUNT(*) FILTER (WHERE conta_realizada AND data_visita BETWEEN v_prev_start AND v_prev_end)::int AS realizadas
    FROM v_fato_visita
    WHERE corretor_auth_id = ANY(v_team_auth)
      AND data_visita BETWEEN v_prev_start AND v_prev_end
  ),
  -- fim do bloco alterado >>

  negocios_ativos_total AS (SELECT COUNT(*)::int AS qtd FROM negocios
    WHERE (corretor_id = ANY(v_team_prof) OR gerente_id = v_gestor_prof)
      AND status = 'ativo' AND fase IN ('em_negociacao','contrato')),
  tarefas_atr AS (SELECT pt.responsavel_id AS auth_id, COUNT(*)::int AS qtd
    FROM pipeline_tarefas pt WHERE pt.responsavel_id = ANY(v_team_auth) AND pt.status = 'pendente'
      AND (pt.vence_em < v_today OR (pt.vence_em = v_today AND COALESCE(pt.hora_vencimento, '23:59'::time) < (v_now AT TIME ZONE 'America/Sao_Paulo')::time))
    GROUP BY pt.responsavel_id),
  leads_sem_acao AS (SELECT pl.corretor_id AS auth_id, COUNT(*)::int AS qtd FROM pipeline_leads pl
    WHERE pl.corretor_id = ANY(v_team_auth) AND COALESCE(pl.arquivado, false) = false
      AND COALESCE(pl.ultima_acao_at, pl.primeiro_contato_em, pl.aceito_em, pl.created_at) < (v_now - INTERVAL '30 days')
    GROUP BY pl.corretor_id),
  alertas_raw AS (SELECT tm.user_id AS auth_id, p.id AS profile_id, p.nome, p.avatar_url,
      COALESCE(ta.qtd, 0) AS tarefas_atrasadas, COALESCE(ls.qtd, 0) AS leads_sem_acao_30d,
      COALESCE(ta.qtd, 0) + COALESCE(ls.qtd, 0) AS score_soma
    FROM (SELECT user_id FROM public.resolve_managed_brokers(p_gestor_id)) tm
    LEFT JOIN profiles p ON p.user_id = tm.user_id
    LEFT JOIN tarefas_atr ta ON ta.auth_id = tm.user_id
    LEFT JOIN leads_sem_acao ls ON ls.auth_id = tm.user_id WHERE true),
  alertas_filtrados AS (SELECT * FROM alertas_raw ORDER BY score_soma DESC, nome ASC LIMIT 5)
  SELECT jsonb_build_object(
    'kpis_top', jsonb_build_object(
      'leads_recebidos', (SELECT qtd FROM leads_atual),
      'leads_recebidos_anterior', (SELECT qtd FROM leads_prev),
      'leads_meta', v_meta.meta_leads,
      'leads_delta_pct', CASE WHEN (SELECT qtd FROM leads_prev) = 0 THEN NULL
                              ELSE ROUND((((SELECT qtd FROM leads_atual)::numeric - (SELECT qtd FROM leads_prev)) / (SELECT qtd FROM leads_prev)) * 100, 1) END,

      -- << MUDA: 6 indicadores independentes + meta + delta
      'visitas_criadas',      (SELECT criadas     FROM vis),
      'visitas_a_realizar',   (SELECT a_realizar  FROM vis),
      'visitas_confirmadas',  (SELECT confirmadas FROM vis),
      'visitas_realizadas',   (SELECT realizadas  FROM vis),
      'visitas_no_show',      (SELECT no_show     FROM vis),
      'visitas_taxa_pct', CASE WHEN ((SELECT realizadas FROM vis) + (SELECT no_show FROM vis)) > 0
                               THEN ROUND((SELECT realizadas FROM vis)::numeric * 100
                                          / ((SELECT realizadas FROM vis) + (SELECT no_show FROM vis)), 1) END,
      'visitas_meta', v_meta.meta_visitas_realizadas,
      'visitas_delta_pct', CASE WHEN (SELECT realizadas FROM vis_prev) = 0 THEN NULL
                                ELSE ROUND((((SELECT realizadas FROM vis)::numeric - (SELECT realizadas FROM vis_prev))
                                            / (SELECT realizadas FROM vis_prev)) * 100, 1) END,
      -- chaves antigas mantidas por compatibilidade (nenhum outro consumidor conhecido, mas custo zero):
      'visitas_agendadas', (SELECT criadas FROM vis),   -- << MUDA (era eixo created_at em visitas_unicas)
      'visitas_total',     (SELECT criadas FROM vis),   -- << MUDA
      -- fim do bloco alterado >>

      'negocios_ativos', (SELECT qtd FROM negocios_ativos_total),
      'negocios_meta', v_meta.meta_negocios,
      'vendas_vgv', (SELECT v FROM vendas_atual),
      'vendas_count', (SELECT qtd FROM vendas_atual),
      'vendas_meta_vgv', v_meta.meta_vgv_assinado,
      'vendas_delta_pct', CASE WHEN (SELECT v FROM vendas_prev) = 0 THEN NULL
                               ELSE ROUND((((SELECT v FROM vendas_atual) - (SELECT v FROM vendas_prev)) / (SELECT v FROM vendas_prev)) * 100, 1) END,
      'periodo', p_periodo, 'p_start', v_p_start, 'p_end', v_p_end),
    'alertas_corretores', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('corretor_id', a.profile_id, 'auth_id', a.auth_id,
        'nome', a.nome, 'avatar_url', a.avatar_url, 'tarefas_atrasadas', a.tarefas_atrasadas,
        'leads_sem_acao_30d', a.leads_sem_acao_30d, 'score_soma', a.score_soma,
        'severity', CASE WHEN a.score_soma >= 70 THEN 'critico' WHEN a.score_soma >= 40 THEN 'atencao' ELSE 'ok' END)
        ORDER BY a.score_soma DESC, a.nome ASC) FROM alertas_filtrados a), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $function$;
```

Observação de digitação: a linha do `v_team_prof` acima está anotada — na migration real ela vai **exatamente** como hoje (`SELECT array_agg(id) INTO v_team_prof FROM profiles WHERE user_id = ANY(v_team_auth);`), sem duplicar o `INTO`.

Divergência consciente com a Central de Relatórios: lá "criadas" = `conta_marcada AND data_criacao no período` (exclui cancelada/no_show criadas no período). Aqui você pediu "sem filtrar status". Se quiser bater 100% com a Central, troco por `COUNT(*) FILTER (WHERE conta_marcada AND data_criacao BETWEEN ...)` — diga qual prevalece.

## (b) Eixo de equipe — impacto da migração

| Dimensão | Hoje (`visitas_unicas`) | Depois (`v_fato_visita`) |
|---|---|---|
| Chave do corretor | `corretor_id` cru, comparado com `v_team_auth` | `corretor_auth_id` = `COALESCE(profiles by user_id, profiles by id)` → resolve visitas gravadas com `profile.id` também |
| Equipe | não usa equipe-na-data | a view traz `equipe`/`gerente_auth_id` via `fn_equipe_na_data`, mas **a RPC continua filtrando por `corretor_auth_id = ANY(v_team_auth)`** — ou seja, o escopo de time segue vindo de `resolve_managed_brokers`, e a equipe histórica **não** muda nada aqui |
| Dedup | 1/cliente/dia (a view `visitas_unicas` também deduplica) | 1/cliente/dia (mesma regra) |
| Tipo | filtra `tipo IS NULL OR tipo = 'lead'` | **`tipo` não é projetado pela view** → passariam a contar reuniões (`negocio`, `visita`) |

Efeito numérico do tipo, últimos 90 dias no total da empresa: +11 `no_show` de `tipo='negocio'` e +1 `realizada` de `tipo='visita'` — ~1,4% do volume. A Central de Relatórios já conta esses casos hoje (usa a view direto).

Recomendação: **manter o comportamento da Central** (não filtrar tipo), porque o objetivo do lote é fazer o card bater com a Central de Relatórios. Se você preferir só visitas de lead, a alternativa é uma linha extra na CTE `vis`: `AND EXISTS (SELECT 1 FROM visitas vv WHERE vv.id = v_fato_visita.visita_id AND (vv.tipo IS NULL OR vv.tipo = 'lead'))` — mas aí o card deixa de bater com a Central. Decisão sua.

## (c) Frontend

`src/hooks/useDashboardGerenteV4Kpis.ts` — interface `KpisTopV4`, bloco de visitas:

```diff
-  visitas_realizadas: number;
-  visitas_agendadas: number;
-  visitas_total: number;
-  visitas_meta: number;
-  visitas_delta_pct: number | null;
+  visitas_criadas: number;
+  visitas_a_realizar: number;
+  visitas_confirmadas: number;
+  visitas_realizadas: number;
+  visitas_no_show: number;
+  visitas_taxa_pct: number | null;
+  visitas_meta: number;
+  visitas_delta_pct: number | null;
```

`src/components/dashboard-v4/V4KpisGrid.tsx` — `VisitasCard`: remove a fração "de Y no mês" e a barra baseada em `visitas_total`. Passa a:

- Destaque: **Realizadas** (número grande) + delta e, se `visitas_meta > 0`, barra `realizadas / meta` (não muda de fonte, só de denominador correto).
- Grade 3×2 de mini-métricas abaixo, com rótulo curto e valor: Criadas · A realizar · Confirmadas · Realizadas · No-show · Comparecimento (`{taxa}%` ou `—`).
- Tons semânticos existentes: no-show em `text-danger-700`, comparecimento em `text-success-700` quando ≥ 70%, neutro abaixo.
- Nenhum hex hardcoded; mantém o card no mesmo grid (`dash-v4-kpis`), altura cresce um pouco — o grid é `auto`, não quebra.

Nenhum outro consumidor de `KpisTopV4` além desses dois arquivos.

## (d) Bug irmão em `V4PanelVisitas.tsx` — separado, opcional

Confirmado: o rodapé conta `status === 'confirmada'` e `'pendente' | 'reagendada'`; nos últimos 90 dias só existem `realizada`, `no_show`, `marcada` → o rodapé mostra sempre "0 confirmadas · 0 pendentes". `STATUS_STYLES` também carrega chaves fantasma (`agendada`, `pendente`, `cancelada`).

Ajuste proposto (se você incluir no lote): rodapé passa a "N visitas · X marcadas · Y realizadas · Z no-show" contando os status reais, e `STATUS_STYLES` fica com `marcada`, `confirmada`, `realizada`, `no_show`, `cancelada` (mantendo `confirmada`/`cancelada` porque são status válidos do domínio, só sem volume hoje), removendo `agendada`/`pendente`/`reagendada` do mapa se você confirmar que não são gravados por nenhum fluxo. Zero mudança de backend.

## (e) Migration, regressão e riscos

**Migration:** 1 única — um `CREATE OR REPLACE FUNCTION`, sem DDL de tabela, sem mudança de assinatura, 1 reload de PostgREST. Dentro do limite de 2/dia.

**Matriz de regressão** (mesmo gerente, mesmo mês; comparar v4 × Central de Relatórios → Visitas):

| # | Verificação | Esperado |
|---|---|---|
| 1 | Criadas (v4) × "criadas/agendadas" da Central | Iguais — ou divergentes apenas pelo ponto marcado em (a), se mantivermos "sem filtro de status" |
| 2 | A realizar, Realizadas, No-show, Taxa | Idênticos à Central |
| 3 | Fração impossível ("18 de 3") | Não existe mais em nenhum período |
| 4 | Leads recebidos / delta | Inalterados |
| 5 | Negócios ativos | Inalterado |
| 6 | Vendas (VGV, count, meta, delta) — 4a | Byte-idênticos ao de hoje |
| 7 | Alertas de corretores | Inalterados |
| 8 | Períodos `hoje` / `semana` / `mes` | Todos coerentes; "hoje" pode ter A realizar > 0 e Realizadas 0 — correto |
| 9 | Gerente sem time | Zeros, sem erro |
| 10 | Dashboard v3 (`get_dashboard_gerente`) | Não tocado; pode divergir do v4 em visitas (é esperado até um lote futuro) |

**Riscos:**
- **Confirmadas nasce 0** — não há esse status na base. Pode parecer bug para o gestor; vale um tooltip "nenhuma visita confirmada no período".
- **Reuniões passam a contar** (~1,4%) se seguirmos a Central — números de visitas do v4 sobem levemente.
- **Divergência v4 × v3** em visitas fica explícita até o v3 ser migrado.
- **Chaves antigas** `visitas_agendadas`/`visitas_total` mudam de significado; mantidas só para não quebrar cache/consumidor esquecido.
- **Custo de query**: `v_fato_visita` tem window function sobre `visitas` inteira; hoje o v4 lia `visitas_unicas`. Volume atual é pequeno (poucos milhares de linhas) — impacto desprezível, mas medível no primeiro load.
- Validação ao vivo no preview, gerente por gerente, antes de declarar pronto.
