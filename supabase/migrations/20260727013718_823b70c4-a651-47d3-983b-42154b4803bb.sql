-- Parte 2/2: rewrite mecânico das 8 funções que ainda filtravam por nomes antigos.
-- Substituições aplicadas: 'vendido'→'ganho'; 'distrato'→ status='perdido';
-- IN ('novo_negocio','proposta','negociacao','documentacao') → IN ('em_negociacao','contrato');
-- CTE "fases" (Novo Negócio / Proposta / Negociação / Contrato Gerado) → (Em Negociação / Contrato).

CREATE OR REPLACE FUNCTION public._kpi_team_window_core(p_team_auth uuid[], p_team_prof uuid[], p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date, p_include_partner_split boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  v_leads_atual int; v_leads_prev int;
  v_vis_criadas int; v_vis_marcadas int; v_vis_realizadas int; v_vis_noshow int; v_vis_real_prev int;
  v_neg_ativos int; v_neg_criados int; v_neg_caidos int; v_neg_criados_prev int;
  v_vgv numeric; v_vendas_qtd int; v_vgv_prev numeric;
  v_oa_tent int; v_oa_aproveitados int; v_oa_ativos_pipe int; v_oa_neg int;
BEGIN
  IF p_team_auth IS NULL THEN p_team_auth := ARRAY[]::uuid[]; END IF;
  IF p_team_prof IS NULL THEN p_team_prof := ARRAY[]::uuid[]; END IF;
  SELECT count(*)::int INTO v_leads_atual FROM pipeline_leads
   WHERE corretor_id = ANY(p_team_auth)
     AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end;
  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_leads_prev FROM pipeline_leads
     WHERE corretor_id = ANY(p_team_auth)
       AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_prev_start AND p_prev_end;
  ELSE v_leads_prev := 0; END IF;
  SELECT count(*)::int,
         (count(*) FILTER (WHERE status IN ('marcada','reagendada')))::int,
         (count(*) FILTER (WHERE status = 'realizada'))::int,
         (count(*) FILTER (WHERE status = 'no_show'))::int
  INTO v_vis_criadas, v_vis_marcadas, v_vis_realizadas, v_vis_noshow
  FROM visitas WHERE corretor_id = ANY(p_team_auth)
    AND data_visita BETWEEN p_start AND p_end AND (tipo IS NULL OR tipo = 'lead');
  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_vis_real_prev FROM visitas
     WHERE corretor_id = ANY(p_team_auth) AND data_visita BETWEEN p_prev_start AND p_prev_end
       AND status = 'realizada' AND (tipo IS NULL OR tipo = 'lead');
  ELSE v_vis_real_prev := 0; END IF;
  SELECT (count(*) FILTER (WHERE status = 'ativo'))::int,
         (count(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end))::int,
         (count(*) FILTER (WHERE status = 'perdido' AND (fase_changed_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end))::int
  INTO v_neg_ativos, v_neg_criados, v_neg_caidos
  FROM negocios WHERE corretor_id = ANY(p_team_prof);
  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_neg_criados_prev FROM negocios
     WHERE corretor_id = ANY(p_team_prof)
       AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_prev_start AND p_prev_end;
  ELSE v_neg_criados_prev := 0; END IF;
  IF p_include_partner_split THEN
    WITH base AS (
      SELECT n.id, n.pipeline_lead_id, n.auth_user_id, COALESCE(n.vgv_final, n.vgv_estimado, 0)::numeric AS valor
      FROM negocios n
      WHERE n.fase = 'ganho' AND n.data_assinatura BETWEEN p_start AND p_end
        AND (n.corretor_id = ANY(p_team_prof) OR n.auth_user_id = ANY(p_team_auth)
             OR EXISTS (SELECT 1 FROM pipeline_parcerias pp
                        WHERE pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status='ativa'
                          AND (pp.corretor_principal_id = ANY(p_team_auth) OR pp.corretor_parceiro_id = ANY(p_team_auth))))
    ), com_split AS (
      SELECT b.id, b.valor,
        CASE WHEN pp.id IS NOT NULL AND pp.corretor_principal_id = ANY(p_team_auth) AND pp.corretor_parceiro_id = ANY(p_team_auth) THEN b.valor
             WHEN pp.id IS NOT NULL AND pp.corretor_principal_id = ANY(p_team_auth) THEN (b.valor * COALESCE(pp.divisao_principal, 50) / 100)
             WHEN pp.id IS NOT NULL AND pp.corretor_parceiro_id = ANY(p_team_auth) THEN (b.valor * COALESCE(pp.divisao_parceiro, 50) / 100)
             ELSE b.valor END AS valor_split
      FROM base b LEFT JOIN pipeline_parcerias pp ON pp.pipeline_lead_id = b.pipeline_lead_id AND pp.status = 'ativa'
    )
    SELECT COALESCE(SUM(valor_split), 0), count(*)::int INTO v_vgv, v_vendas_qtd FROM com_split;
  ELSE
    SELECT COALESCE(SUM(COALESCE(vgv_final, vgv_estimado, 0)), 0), count(*)::int INTO v_vgv, v_vendas_qtd
    FROM negocios WHERE corretor_id = ANY(p_team_prof) AND fase = 'ganho' AND data_assinatura BETWEEN p_start AND p_end;
  END IF;
  IF p_prev_start IS NOT NULL THEN
    SELECT COALESCE(SUM(COALESCE(vgv_final, vgv_estimado, 0)), 0) INTO v_vgv_prev
    FROM negocios WHERE corretor_id = ANY(p_team_prof) AND fase = 'ganho' AND data_assinatura BETWEEN p_prev_start AND p_prev_end;
  ELSE v_vgv_prev := 0; END IF;
  SELECT count(*)::int, (count(*) FILTER (WHERE resultado = 'com_interesse'))::int
  INTO v_oa_tent, v_oa_aproveitados FROM oferta_ativa_tentativas
  WHERE corretor_id = ANY(p_team_auth) AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end;
  SELECT count(*)::int INTO v_oa_ativos_pipe FROM pipeline_leads
  WHERE corretor_id = ANY(p_team_auth) AND origem IN ('Oferta Ativa', 'oferta_ativa') AND arquivado = false;
  SELECT count(*)::int INTO v_oa_neg FROM negocios n
  WHERE n.corretor_id = ANY(p_team_prof)
    AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    AND EXISTS (SELECT 1 FROM pipeline_leads pl WHERE pl.id = n.pipeline_lead_id AND pl.origem IN ('Oferta Ativa', 'oferta_ativa'));
  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('start', p_start, 'end', p_end, 'prev_start', p_prev_start, 'prev_end', p_prev_end),
    'leads', jsonb_build_object('recebidos', v_leads_atual, 'recebidos_prev', v_leads_prev,
       'delta_pct', CASE WHEN v_leads_prev > 0 THEN round((v_leads_atual - v_leads_prev) * 100.0 / v_leads_prev, 1) END),
    'visitas', jsonb_build_object('criadas', v_vis_criadas, 'marcadas', v_vis_marcadas,
       'realizadas', v_vis_realizadas, 'no_show', v_vis_noshow, 'realizadas_prev', v_vis_real_prev,
       'delta_pct', CASE WHEN v_vis_real_prev > 0 THEN round((v_vis_realizadas - v_vis_real_prev) * 100.0 / v_vis_real_prev, 1) END,
       'taxa_comparecimento_pct', CASE WHEN (v_vis_realizadas + v_vis_noshow) > 0 THEN round(v_vis_realizadas * 100.0 / (v_vis_realizadas + v_vis_noshow), 1) END),
    'negocios', jsonb_build_object('ativos', v_neg_ativos, 'criados', v_neg_criados, 'caidos', v_neg_caidos,
       'criados_prev', v_neg_criados_prev,
       'delta_pct', CASE WHEN v_neg_criados_prev > 0 THEN round((v_neg_criados - v_neg_criados_prev) * 100.0 / v_neg_criados_prev, 1) END),
    'vendas', jsonb_build_object('vgv', v_vgv, 'count', v_vendas_qtd, 'vgv_prev', v_vgv_prev,
       'delta_pct', CASE WHEN v_vgv_prev > 0 THEN round((v_vgv - v_vgv_prev) * 100.0 / v_vgv_prev, 1) END,
       'ticket_medio', CASE WHEN v_vendas_qtd > 0 THEN round(v_vgv / v_vendas_qtd, 2) END),
    'oferta_ativa', jsonb_build_object('tentativas', v_oa_tent, 'aproveitados', v_oa_aproveitados,
       'ativos_no_pipeline', v_oa_ativos_pipe, 'negocios_da_oa', v_oa_neg,
       'conversao_pct', CASE WHEN v_oa_tent > 0 THEN round(v_oa_aproveitados * 100.0 / v_oa_tent, 1) END)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_dia(p_gestor_id uuid, p_visitas_range text DEFAULT 'hoje'::text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_now_brt timestamp := (v_now AT TIME ZONE 'America/Sao_Paulo');
  v_today date := v_now_brt::date;
  v_minutes_brt int := EXTRACT(HOUR FROM v_now_brt)::int * 60 + EXTRACT(MINUTE FROM v_now_brt)::int;
  v_turno_atual text; v_v_start date; v_v_end date;
  v_team_auth uuid[]; v_team_prof uuid[]; v_gestor_prof uuid;
  v_visitas jsonb; v_pipeline jsonb; v_roleta jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_turno_atual := CASE WHEN v_minutes_brt < (13*60 + 30) THEN 'manha' WHEN v_minutes_brt < (18*60 + 30) THEN 'tarde' ELSE 'noturna' END;
  IF p_visitas_range = 'semana' THEN
    v_v_start := date_trunc('week', v_today)::date;
    v_v_end := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
  ELSE v_v_start := v_today; v_v_end := v_today; END IF;
  SELECT array_agg(user_id) INTO v_team_auth FROM public.resolve_managed_brokers(p_gestor_id);
  IF v_team_auth IS NULL THEN v_team_auth := ARRAY[]::uuid[]; END IF;
  SELECT array_agg(id) INTO v_team_prof FROM profiles WHERE user_id = ANY(v_team_auth);
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;
  SELECT id INTO v_gestor_prof FROM profiles WHERE user_id = p_gestor_id LIMIT 1;

  SELECT COALESCE(jsonb_agg(row_to_json(v_row) ORDER BY v_row.data_visita, v_row.hora_visita), '[]'::jsonb)
  INTO v_visitas FROM (
    SELECT v.id AS visita_id, v.data_visita, to_char(v.hora_visita, 'HH24:MI') AS horario_str,
      v.hora_visita, v.nome_cliente AS cliente_nome,
      COALESCE(v.empreendimento, v.local_visita) AS imovel_resumo,
      v.corretor_id, p.nome AS corretor_nome, p.avatar_url AS corretor_avatar, v.status
    FROM visitas v LEFT JOIN profiles p ON p.user_id = v.corretor_id
    WHERE v.corretor_id = ANY(v_team_auth) AND v.data_visita BETWEEN v_v_start AND v_v_end
      AND (v.tipo IS NULL OR v.tipo = 'lead')
    ORDER BY v.data_visita, v.hora_visita NULLS LAST LIMIT 10
  ) v_row;

  WITH fases AS (
    SELECT * FROM (VALUES ('em_negociacao', 'Em Negociação', 1), ('contrato', 'Contrato', 2)) AS f(fase, fase_label, ordem)
  ),
  counts AS (
    SELECT n.fase, COUNT(*)::int AS qtd FROM negocios n
    WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.status = 'ativo' AND n.fase IN ('em_negociacao','contrato')
    GROUP BY n.fase
  ),
  top_per_fase AS (
    SELECT f.fase,
      COALESCE(jsonb_agg(jsonb_build_object('negocio_id', t.id, 'cliente_nome', t.nome_cliente,
        'vgv', COALESCE(t.vgv_final, t.vgv_estimado, 0)) ORDER BY t.updated_at DESC)
        FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS cards
    FROM fases f
    LEFT JOIN LATERAL (
      SELECT n.id, n.nome_cliente, n.vgv_final, n.vgv_estimado, n.updated_at
      FROM negocios n WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
        AND n.status = 'ativo' AND n.fase = f.fase ORDER BY n.updated_at DESC LIMIT 3
    ) t ON true GROUP BY f.fase
  )
  SELECT jsonb_agg(jsonb_build_object('fase', f.fase, 'fase_label', f.fase_label, 'ordem', f.ordem,
    'count_total', COALESCE(c.qtd, 0), 'top_cards', COALESCE(tp.cards, '[]'::jsonb)) ORDER BY f.ordem)
  INTO v_pipeline FROM fases f LEFT JOIN counts c ON c.fase = f.fase LEFT JOIN top_per_fase tp ON tp.fase = f.fase;

  WITH cred AS (
    SELECT rc.corretor_id, rc.janela FROM roleta_credenciamentos rc
    WHERE rc.data = v_today AND rc.status = 'aprovado' AND rc.saiu_em IS NULL
      AND rc.corretor_id = ANY(v_team_prof)
  ), dist_dia AS (
    SELECT rd.corretor_id,
      COUNT(*) FILTER (WHERE (rd.enviado_em AT TIME ZONE 'America/Sao_Paulo')::date = v_today)::int AS recebidos,
      COUNT(*) FILTER (WHERE rd.aceito_em IS NOT NULL AND (rd.aceito_em AT TIME ZONE 'America/Sao_Paulo')::date = v_today)::int AS aceitos
    FROM roleta_distribuicoes rd WHERE rd.corretor_id IN (SELECT corretor_id FROM cred) GROUP BY rd.corretor_id
  )
  SELECT jsonb_build_object('turno_ativo_atual', v_turno_atual,
    'credenciados', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('corretor_id', c.corretor_id, 'nome', p.nome, 'avatar_url', p.avatar_url,
        'janela', c.janela, 'turno_ativo_agora', (c.janela = v_turno_atual OR c.janela = 'dia_todo'),
        'leads_recebidos_dia', COALESCE(d.recebidos, 0), 'leads_aceitos_dia', COALESCE(d.aceitos, 0))
        ORDER BY (c.janela = v_turno_atual OR c.janela = 'dia_todo') DESC, p.nome ASC)
       FROM cred c LEFT JOIN profiles p ON p.id = c.corretor_id
       LEFT JOIN dist_dia d ON d.corretor_id = c.corretor_id), '[]'::jsonb)) INTO v_roleta;

  RETURN jsonb_build_object('visitas', v_visitas, 'mini_pipeline', COALESCE(v_pipeline, '[]'::jsonb), 'roleta', v_roleta);
END; $function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_kpis(p_gestor_id uuid, p_periodo text DEFAULT 'hoje'::text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
  SELECT array_agg(id) INTO v_team_prof FROM profiles WHERE user_id = ANY(v_team_auth);
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;
  SELECT id INTO v_gestor_prof FROM profiles WHERE user_id = p_gestor_id LIMIT 1;
  SELECT * INTO v_meta FROM ceo_metas_mensais WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1;
  IF v_meta IS NULL THEN v_meta.meta_vgv_assinado := 0; v_meta.meta_leads := 400;
    v_meta.meta_visitas_realizadas := 0; v_meta.meta_negocios := 90; END IF;

  WITH
  vendas_atual AS (SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.data_assinatura BETWEEN v_p_start AND v_p_end),
  vendas_prev AS (SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.data_assinatura BETWEEN v_prev_start AND v_prev_end),
  leads_atual AS (SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end),
  leads_prev AS (SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_prev_start AND v_prev_end),
  visitas_atual AS (SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status = 'realizada'),
  visitas_prev AS (SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth) AND data_visita BETWEEN v_prev_start AND v_prev_end
      AND (tipo IS NULL OR tipo = 'lead') AND status = 'realizada'),
  visitas_agendadas AS (SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status IN ('agendada','marcada','confirmada')),
  visitas_total AS (SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')),
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
      'visitas_realizadas', (SELECT qtd FROM visitas_atual),
      'visitas_agendadas', (SELECT qtd FROM visitas_agendadas),
      'visitas_total', (SELECT qtd FROM visitas_total),
      'visitas_meta', v_meta.meta_visitas_realizadas,
      'visitas_delta_pct', CASE WHEN (SELECT qtd FROM visitas_prev) = 0 THEN NULL
                                ELSE ROUND((((SELECT qtd FROM visitas_atual)::numeric - (SELECT qtd FROM visitas_prev)) / (SELECT qtd FROM visitas_prev)) * 100, 1) END,
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

CREATE OR REPLACE FUNCTION public.get_pipeline_equipes_overview()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_t time := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_mes text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  v_month_start date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_excl text[] := ARRAY['descarte','convertido','venda','contrato_gerado'];
  v_neg_excl text[] := ARRAY['ganho'];
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  WITH team AS (SELECT tm.user_id AS corretor_auth, tm.gerente_id FROM public.team_members tm
    WHERE tm.status = 'ativo' AND tm.user_id IS NOT NULL AND tm.gerente_id IS NOT NULL),
  leads_ativos AS (SELECT pl.id, pl.corretor_id AS corretor_auth, pl.ultima_acao_at
    FROM public.pipeline_leads pl JOIN team t ON t.corretor_auth = pl.corretor_id
    JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.arquivado = false AND pl.negocio_id IS NULL AND (ps.tipo IS NULL OR NOT (ps.tipo = ANY(v_excl)))),
  tarefas AS (SELECT la.id AS lead_id, la.corretor_auth,
    bool_or(pt.vence_em < v_today OR (pt.vence_em = v_today AND pt.hora_vencimento IS NOT NULL AND pt.hora_vencimento < v_now_t)) AS overdue
    FROM leads_ativos la LEFT JOIN public.pipeline_tarefas pt ON pt.pipeline_lead_id = la.id AND pt.status = 'pendente'
    GROUP BY la.id, la.corretor_auth),
  agg_corretor AS (SELECT t.corretor_auth, t.gerente_id, count(tk.lead_id)::int AS leads_ativos,
    count(*) FILTER (WHERE tk.overdue)::int AS atrasados
    FROM team t LEFT JOIN tarefas tk ON tk.corretor_auth = t.corretor_auth GROUP BY t.corretor_auth, t.gerente_id),
  ult_atividade AS (SELECT la.corretor_auth, max(la.ultima_acao_at) AS ultima_atividade FROM leads_ativos la GROUP BY la.corretor_auth),
  neg_corretor AS (SELECT t.corretor_auth, t.gerente_id,
      count(n.id) FILTER (WHERE n.status = 'ativo' AND NOT (n.fase = ANY(v_neg_excl)))::int AS negocios,
      COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado)) FILTER (WHERE n.status = 'ativo' AND NOT (n.fase = ANY(v_neg_excl))), 0)::numeric AS vgv_pipeline_ativo
    FROM team t LEFT JOIN public.negocios n ON n.auth_user_id = t.corretor_auth GROUP BY t.corretor_auth, t.gerente_id),
  corretor_row AS (SELECT ac.gerente_id, ac.corretor_auth, p.id AS profile_id, p.nome,
      COALESCE(ac.leads_ativos, 0) AS leads_ativos, COALESCE(ac.atrasados, 0) AS atrasados,
      COALESCE(nc.negocios, 0) AS negocios, COALESCE(nc.vgv_pipeline_ativo, 0) AS vgv_pipeline_ativo,
      ua.ultima_atividade
    FROM agg_corretor ac LEFT JOIN neg_corretor nc ON nc.corretor_auth = ac.corretor_auth
    LEFT JOIN ult_atividade ua ON ua.corretor_auth = ac.corretor_auth
    LEFT JOIN public.profiles p ON p.user_id = ac.corretor_auth),
  vgv_assinado_equipe AS (SELECT n.equipe_gerente_auth_id AS gerente_id,
      COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado)), 0)::numeric AS vgv_assinado_mes
    FROM public.negocios n WHERE n.fase = 'ganho' AND n.data_assinatura IS NOT NULL
      AND n.data_assinatura >= v_month_start AND n.equipe_gerente_auth_id IS NOT NULL
    GROUP BY n.equipe_gerente_auth_id),
  gestor_oper AS (SELECT cr.gerente_id, count(*)::int AS qtd_corretores,
      COALESCE(sum(cr.leads_ativos), 0)::int AS total_leads,
      COALESCE(sum(cr.atrasados), 0)::int AS atrasados,
      COALESCE(sum(cr.negocios), 0)::int AS negocios,
      COALESCE(sum(cr.vgv_pipeline_ativo), 0)::numeric AS vgv_pipeline_ativo,
      jsonb_agg(jsonb_build_object('auth_id', cr.corretor_auth, 'profile_id', cr.profile_id,
        'nome', cr.nome, 'leads_ativos', cr.leads_ativos, 'atrasados', cr.atrasados,
        'negocios', cr.negocios, 'ultima_atividade', cr.ultima_atividade) ORDER BY cr.leads_ativos DESC) AS corretores
    FROM corretor_row cr GROUP BY cr.gerente_id),
  gestor_final AS (SELECT go.gerente_id, gp.id AS profile_id, gp.nome, gp.avatar_url,
      go.qtd_corretores, go.total_leads, go.atrasados, go.negocios, go.vgv_pipeline_ativo,
      COALESCE(va.vgv_assinado_mes, 0) AS vgv_assinado_mes, cm.meta_vgv_assinado AS meta_vgv,
      go.corretores
    FROM gestor_oper go LEFT JOIN public.profiles gp ON gp.user_id = go.gerente_id
    LEFT JOIN vgv_assinado_equipe va ON va.gerente_id = go.gerente_id
    LEFT JOIN public.ceo_metas_mensais cm ON cm.gerente_id = go.gerente_id AND cm.mes = v_mes)
  SELECT jsonb_build_object(
    'escritorio', jsonb_build_object(
      'total_leads_ativos', COALESCE((SELECT sum(total_leads) FROM gestor_final), 0),
      'atrasados', COALESCE((SELECT sum(atrasados) FROM gestor_final), 0),
      'negocios', COALESCE((SELECT sum(negocios) FROM gestor_final), 0),
      'vgv_assinado_mes', COALESCE((SELECT sum(vgv_assinado_mes) FROM gestor_final), 0),
      'vgv_pipeline_ativo', COALESCE((SELECT sum(vgv_pipeline_ativo) FROM gestor_final), 0)),
    'gestores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'auth_id', gf.gerente_id, 'profile_id', gf.profile_id, 'nome', gf.nome, 'avatar_url', gf.avatar_url,
        'qtd_corretores', gf.qtd_corretores, 'total_leads', gf.total_leads,
        'atrasados', gf.atrasados, 'negocios', gf.negocios, 'vgv_assinado_mes', gf.vgv_assinado_mes,
        'vgv_pipeline_ativo', gf.vgv_pipeline_ativo, 'meta_vgv', gf.meta_vgv,
        'meta_pct', CASE WHEN gf.meta_vgv IS NULL OR gf.meta_vgv = 0 THEN NULL
                          ELSE round((gf.vgv_assinado_mes / gf.meta_vgv) * 100)::numeric END,
        'corretores', gf.corretores) ORDER BY gf.vgv_assinado_mes DESC)
      FROM gestor_final gf), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_relatorio_equipes(p_gestor_id uuid, p_start date, p_end date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[]; v_result jsonb;
  v_neg_stage uuid := 'de6cee2f-8dda-4e60-a4e2-6b7f21aeae96';
  v_descarte uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
  v_caiu uuid := '43997e74-aa71-4796-b7d0-11abae2d49ac';
  v_ganho uuid := '2d7739eb-1787-4ad6-887a-7a4a32dcfc05';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_gestor_id IS NULL THEN
    IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
  END IF;
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));
  WITH base AS (
    SELECT DISTINCT tm.user_id AS auth_id, p.id AS profile_id, p.nome AS corretor_nome, p.avatar_url,
           tm.gerente_id AS gerente_auth, pg.nome AS gerente_nome
    FROM team_members tm JOIN profiles p ON p.user_id = tm.user_id
    JOIN profiles pg ON pg.user_id = tm.gerente_id
    WHERE tm.user_id = ANY(v_team_auth) AND tm.status='ativo' AND tm.gerente_id IS NOT NULL),
  leads AS (SELECT corretor_id AS auth_id, COUNT(*)::int AS leads_recebidos FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1),
  vis AS (SELECT corretor_id AS auth_id,
    COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end)::int AS visitas_marcadas,
    COUNT(*) FILTER (WHERE status='realizada' AND data_visita BETWEEN p_start AND p_end)::int AS visitas_realizadas
    FROM visitas WHERE corretor_id = ANY(v_team_auth) GROUP BY 1),
  pipe AS (SELECT corretor_id AS auth_id,
    COUNT(*) FILTER (WHERE COALESCE(arquivado,false)=false AND stage_id NOT IN (v_descarte, v_caiu, v_ganho))::int AS pipeline_ativo,
    COUNT(*) FILTER (WHERE COALESCE(arquivado,false)=false AND stage_id = v_neg_stage)::int AS negocios_andamento,
    COUNT(*) FILTER (WHERE estagnado = true)::int AS estagnados
    FROM pipeline_leads WHERE corretor_id = ANY(v_team_auth) GROUP BY 1),
  desc_ev AS (SELECT pl.corretor_id AS auth_id, COUNT(DISTINCT h.pipeline_lead_id)::int AS descartes
    FROM pipeline_historico h JOIN pipeline_leads pl ON pl.id = h.pipeline_lead_id
    WHERE pl.corretor_id = ANY(v_team_auth) AND h.stage_novo_id IN (v_descarte, v_caiu)
      AND (h.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end GROUP BY 1),
  vendas AS (SELECT corretor_id AS profile_id, COUNT(*)::int AS vendas_assinadas,
    SUM(COALESCE(vgv_final, vgv_estimado))::numeric AS vgv
    FROM negocios WHERE corretor_id = ANY(v_team_prof) AND fase = 'ganho'
      AND data_assinatura BETWEEN p_start AND p_end GROUP BY 1),
  corretores AS (SELECT b.gerente_auth, b.gerente_nome, b.corretor_nome, b.avatar_url,
    COALESCE(l.leads_recebidos,0) AS leads_recebidos, COALESCE(vi.visitas_marcadas,0) AS visitas_marcadas,
    COALESCE(vi.visitas_realizadas,0) AS visitas_realizadas, COALESCE(pp.pipeline_ativo,0) AS pipeline_ativo,
    COALESCE(pp.negocios_andamento,0) AS negocios_andamento, COALESCE(de.descartes,0) AS descartes,
    COALESCE(pp.estagnados,0) AS estagnados, COALESCE(v.vendas_assinadas,0) AS vendas_assinadas,
    COALESCE(v.vgv,0) AS vgv
    FROM base b LEFT JOIN leads l ON l.auth_id = b.auth_id LEFT JOIN vis vi ON vi.auth_id = b.auth_id
    LEFT JOIN pipe pp ON pp.auth_id = b.auth_id LEFT JOIN desc_ev de ON de.auth_id = b.auth_id
    LEFT JOIN vendas v ON v.profile_id = b.profile_id),
  neg_list AS (SELECT bg.gerente_nome AS equipe, p.nome AS corretor, pl.nome AS cliente,
    pl.empreendimento, pl.valor_estimado,
    GREATEST(0, (CURRENT_DATE - (pl.stage_changed_at AT TIME ZONE 'America/Sao_Paulo')::date))::int AS dias_na_etapa
    FROM pipeline_leads pl JOIN profiles p ON p.user_id = pl.corretor_id
    JOIN LATERAL (SELECT pg.nome AS gerente_nome FROM team_members tm
      JOIN profiles pg ON pg.user_id = tm.gerente_id
      WHERE tm.user_id = pl.corretor_id AND tm.status='ativo' AND tm.gerente_id IS NOT NULL LIMIT 1) bg ON true
    WHERE pl.corretor_id = ANY(v_team_auth) AND pl.stage_id = v_neg_stage AND COALESCE(pl.arquivado,false)=false),
  emp AS (SELECT COALESCE(NULLIF(TRIM(empreendimento),''),'(Sem empreendimento)') AS empreendimento,
    COUNT(*)::int AS leads FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1 ORDER BY 2 DESC LIMIT 8)
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('start', p_start, 'end', p_end),
    'corretores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'gerente_id', gerente_auth, 'gerente_nome', gerente_nome, 'nome', corretor_nome, 'avatar_url', avatar_url,
        'leads_recebidos', leads_recebidos, 'visitas_marcadas', visitas_marcadas,
        'visitas_realizadas', visitas_realizadas, 'pipeline_ativo', pipeline_ativo,
        'negocios_andamento', negocios_andamento, 'descartes', descartes, 'estagnados', estagnados,
        'vendas_assinadas', vendas_assinadas, 'vgv', vgv)
      ORDER BY gerente_nome, vgv DESC, corretor_nome) FROM corretores), '[]'::jsonb),
    'negocios_andamento', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'equipe', equipe, 'corretor', corretor, 'cliente', cliente, 'empreendimento', empreendimento,
        'valor_estimado', valor_estimado, 'dias_na_etapa', dias_na_etapa) ORDER BY dias_na_etapa DESC) FROM neg_list), '[]'::jsonb),
    'top_empreendimentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'empreendimento', empreendimento, 'leads', leads) ORDER BY leads DESC) FROM emp), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.get_relatorio_negocios(p_gestor_id uuid, p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_team_auth uuid[]; v_team_prof uuid[]; v_core jsonb; v_extras jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_gestor_id IS NULL THEN
    IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
  END IF;
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));
  v_core := _kpi_team_window_core(v_team_auth, v_team_prof, p_start, p_end, p_prev_start, p_prev_end, true);
  WITH f AS (SELECT COALESCE(fase,'(sem fase)') AS fase, COUNT(*) AS qtd,
      AVG(COALESCE(vgv_final, vgv_estimado))::numeric AS ticket_medio,
      AVG(EXTRACT(EPOCH FROM (now() - fase_changed_at))/86400)::numeric AS dias_em_fase
    FROM negocios WHERE corretor_id = ANY(v_team_prof) AND status = 'ativo' GROUP BY 1)
  SELECT jsonb_build_object('por_fase', COALESCE(jsonb_agg(jsonb_build_object(
      'fase', fase, 'qtd', qtd, 'ticket_medio', ROUND(ticket_medio,2),
      'tempo_medio_em_fase_dias', ROUND(dias_em_fase,1))),'[]'::jsonb)) INTO v_extras FROM f;
  RETURN v_core || jsonb_build_object('extras', v_extras);
END $function$;

CREATE OR REPLACE FUNCTION public.get_relatorio_origem_performance(p_start date, p_end date, p_corretor_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(lead_id uuid, nome text, created_at timestamp with time zone, origem text, campanha text, conjunto_anuncio text, anuncio text, plataforma text, empreendimento text, corretor_id uuid, corretor_nome text, stage_nome text, stage_ordem integer, motivo_descarte text, tipo_descarte text, primeiro_contato_em timestamp with time zone, primeiro_contato_em_v1 timestamp with time zone, origem_primeiro_contato text, tempo_ate_primeiro_contato_min integer, tem_visita_realizada boolean, tem_venda boolean, vgv numeric, teve_contato_v3 boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT pl.id, pl.nome, pl.created_at, pl.origem, pl.campanha, pl.conjunto_anuncio,
    pl.anuncio, pl.plataforma, pl.empreendimento, pl.corretor_id,
    p.nome, st.nome, st.ordem, pl.motivo_descarte, pl.tipo_descarte,
    pc.t, pl.primeiro_contato_em,
    CASE WHEN pc.origem_tag IS NOT NULL THEN pc.origem_tag
         WHEN st.ordem >= 1 AND st.ordem <= 7 THEN 'mudanca_etapa' ELSE NULL END,
    CASE WHEN pc.t IS NOT NULL THEN GREATEST(0, round(extract(epoch FROM (pc.t - pl.created_at))/60))::int ELSE NULL END,
    COALESCE(v.tem_visita, false), COALESCE(n.tem_venda, false), COALESCE(n.vgv, 0),
    (pc.t IS NOT NULL OR (st.ordem >= 1 AND st.ordem <= 7))
  FROM pipeline_leads pl
  LEFT JOIN profiles p ON p.user_id = pl.corretor_id
  LEFT JOIN pipeline_stages st ON st.id = pl.stage_id
  LEFT JOIN LATERAL (SELECT t, origem_tag FROM (
      SELECT min(w.timestamp) AS t, 'whatsapp'::text AS origem_tag FROM whatsapp_mensagens w
       WHERE w.lead_id = pl.id AND w.direction IN ('sent','out')
      UNION ALL
      SELECT min(a.created_at) AS t, 'atividade'::text AS origem_tag FROM pipeline_atividades a
       WHERE a.pipeline_lead_id = pl.id
         AND (a.tipo IN ('whatsapp','ligacao','contato','mensagem','email','visita','reuniao','proposta','nao_atendeu') OR a.tipo_contato IS NOT NULL)
    ) s WHERE t IS NOT NULL ORDER BY t ASC LIMIT 1) pc ON true
  LEFT JOIN LATERAL (SELECT true AS tem_visita FROM visitas vi WHERE vi.pipeline_lead_id = pl.id AND vi.status = 'realizada' LIMIT 1) v ON true
  LEFT JOIN LATERAL (SELECT (count(*) > 0) AS tem_venda,
      sum(COALESCE(ng.vgv_final, ng.vgv_estimado, 0)) AS vgv
      FROM negocios ng WHERE ng.pipeline_lead_id = pl.id AND ng.fase = 'ganho') n ON true
  WHERE pl.created_at::date >= p_start AND pl.created_at::date <= p_end
    AND (p_corretor_ids IS NULL OR pl.corretor_id = ANY(p_corretor_ids));
$function$;

CREATE OR REPLACE FUNCTION public.get_relatorio_pipeline_leads(p_gestor_id uuid, p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[]; v_core jsonb; v_extras jsonb;
  v_pipeline_ativo int; v_total_ativos int; v_atualizados_48h int; v_leads_com_visita int;
  v_por_segmento jsonb; v_por_origem jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_gestor_id IS NULL THEN
    IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
  END IF;
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));
  v_core := _kpi_team_window_core(v_team_auth, v_team_prof, p_start, p_end, p_prev_start, p_prev_end, true);
  SELECT COUNT(*) INTO v_pipeline_ativo FROM pipeline_leads pl
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.corretor_id = ANY(v_team_auth) AND COALESCE(pl.arquivado,false) = false
      AND ps.pipeline_tipo = 'leads' AND ps.tipo NOT IN ('convertido', 'descarte');
  SELECT COUNT(*), COUNT(*) FILTER (WHERE pl.ultima_acao_at >= now() - interval '48 hours')
    INTO v_total_ativos, v_atualizados_48h
  FROM pipeline_leads pl JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(v_team_auth) AND COALESCE(pl.arquivado,false) = false
    AND ps.pipeline_tipo = 'leads' AND ps.tipo NOT IN ('convertido', 'descarte');
  SELECT COUNT(DISTINCT v.pipeline_lead_id) INTO v_leads_com_visita FROM visitas v
  WHERE v.corretor_id = ANY(v_team_auth) AND v.data_visita BETWEEN p_start AND p_end AND v.pipeline_lead_id IS NOT NULL;

  WITH seg_leads AS (SELECT _central_segmento(empreendimento, segmento_id) AS seg, COUNT(*) AS leads
    FROM pipeline_leads WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1),
  seg_vis AS (SELECT _central_segmento(empreendimento, NULL) AS seg, COUNT(*) FILTER (WHERE status='realizada') AS visitas
    FROM visitas WHERE corretor_id = ANY(v_team_auth) AND data_visita BETWEEN p_start AND p_end AND (tipo IS NULL OR tipo='lead') GROUP BY 1),
  seg_vgv AS (SELECT _central_segmento(empreendimento, NULL) AS seg, COUNT(*) AS vendas,
      SUM(COALESCE(vgv_final, vgv_estimado, 0)) AS vgv
    FROM negocios WHERE corretor_id = ANY(v_team_prof) AND fase = 'ganho'
      AND data_assinatura BETWEEN p_start AND p_end GROUP BY 1),
  seg_all AS (SELECT seg FROM seg_leads UNION SELECT seg FROM seg_vis UNION SELECT seg FROM seg_vgv)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('segmento', a.seg,
      'leads', COALESCE(l.leads,0), 'visitas', COALESCE(v.visitas,0),
      'vendas', COALESCE(g.vendas,0), 'vgv', COALESCE(g.vgv,0))
    ORDER BY COALESCE(g.vgv,0) DESC, COALESCE(l.leads,0) DESC), '[]'::jsonb)
  INTO v_por_segmento FROM seg_all a
  LEFT JOIN seg_leads l ON l.seg = a.seg LEFT JOIN seg_vis v ON v.seg = a.seg LEFT JOIN seg_vgv g ON g.seg = a.seg;

  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY (s.leads) DESC), '[]'::jsonb)
  INTO v_por_origem FROM (
    SELECT _central_origem(pl.origem) AS origem, COUNT(*) AS leads,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM visitas v
        WHERE v.pipeline_lead_id = pl.id AND v.data_visita BETWEEN p_start AND p_end)) AS com_visita,
      ROUND(COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM visitas v
        WHERE v.pipeline_lead_id = pl.id AND v.data_visita BETWEEN p_start AND p_end)) * 100.0 / NULLIF(COUNT(*),0), 1) AS conv_pct
    FROM pipeline_leads pl WHERE pl.corretor_id = ANY(v_team_auth)
      AND (COALESCE(pl.aceito_em, pl.distribuido_em, pl.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1 ORDER BY leads DESC LIMIT 12) s;

  v_extras := jsonb_build_object('pipeline_ativo', v_pipeline_ativo,
    'taxa_atualizacao_48h', CASE WHEN v_total_ativos>0 THEN ROUND((v_atualizados_48h::numeric / v_total_ativos)*100, 1) ELSE NULL END,
    'leads_com_visita_periodo', v_leads_com_visita,
    'conversao_lead_visita_pct', CASE WHEN (v_core->'leads'->>'recebidos')::int > 0
        THEN ROUND((v_leads_com_visita::numeric / (v_core->'leads'->>'recebidos')::int)*100, 1) ELSE NULL END,
    'por_segmento', v_por_segmento, 'por_origem', v_por_origem);
  RETURN v_core || jsonb_build_object('extras', v_extras);
END $function$;