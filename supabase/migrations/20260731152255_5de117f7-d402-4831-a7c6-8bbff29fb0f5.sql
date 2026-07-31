-- 1) Fonte deduplicada da tabela de visitas
CREATE OR REPLACE VIEW public.visitas_unicas AS
SELECT r.*
FROM (
  SELECT v.*,
         COALESCE(v.pipeline_lead_id::text, lower(btrim(COALESCE(v.nome_cliente,'')))) AS cliente_key,
         row_number() OVER (
           PARTITION BY COALESCE(v.pipeline_lead_id::text, lower(btrim(COALESCE(v.nome_cliente,'')))), v.data_visita
           ORDER BY CASE v.status
                      WHEN 'realizada' THEN 1 WHEN 'confirmada' THEN 2 WHEN 'marcada' THEN 3
                      WHEN 'reagendada' THEN 4 WHEN 'no_show' THEN 5 WHEN 'cancelada' THEN 6 ELSE 7 END,
                    v.created_at, v.id
         ) AS seq_dia
  FROM public.visitas v
) r
WHERE r.seq_dia = 1;

GRANT SELECT ON public.visitas_unicas TO authenticated;
GRANT SELECT ON public.visitas_unicas TO service_role;

-- 2) Views analíticas passam a expor só a visita principal do dia
CREATE OR REPLACE VIEW public.v_fato_visita_principal AS
SELECT * FROM public.v_fato_visita WHERE visita_principal_dia;
GRANT SELECT ON public.v_fato_visita_principal TO authenticated;
GRANT SELECT ON public.v_fato_visita_principal TO service_role;

CREATE OR REPLACE VIEW public.v_kpi_visitas_principal AS
SELECT * FROM public.v_kpi_visitas WHERE visita_principal_dia;
GRANT SELECT ON public.v_kpi_visitas_principal TO authenticated;
GRANT SELECT ON public.v_kpi_visitas_principal TO service_role;

-- 3) Funções que contam visitas

CREATE OR REPLACE FUNCTION public._kpi_team_window_core(p_team_auth uuid[], p_team_prof uuid[], p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date, p_include_partner_split boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
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
  FROM visitas_unicas WHERE corretor_id = ANY(p_team_auth)
    AND data_visita BETWEEN p_start AND p_end AND (tipo IS NULL OR tipo = 'lead')
    AND (origem IS NULL OR origem NOT LIKE 'backfill_%');
  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_vis_real_prev FROM visitas_unicas
     WHERE corretor_id = ANY(p_team_auth) AND data_visita BETWEEN p_prev_start AND p_prev_end
       AND status = 'realizada' AND (tipo IS NULL OR tipo = 'lead')
       AND (origem IS NULL OR origem NOT LIKE 'backfill_%');
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
  visitas_atual AS (SELECT COUNT(*)::int AS qtd FROM visitas_unicas
    WHERE corretor_id = ANY(v_team_auth) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status = 'realizada'),
  visitas_prev AS (SELECT COUNT(*)::int AS qtd FROM visitas_unicas
    WHERE corretor_id = ANY(v_team_auth) AND data_visita BETWEEN v_prev_start AND v_prev_end
      AND (tipo IS NULL OR tipo = 'lead') AND status = 'realizada'),
  visitas_agendadas AS (SELECT COUNT(*)::int AS qtd FROM visitas_unicas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status IN ('agendada','marcada','confirmada')),
  visitas_total AS (SELECT COUNT(*)::int AS qtd FROM visitas_unicas
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

CREATE OR REPLACE FUNCTION public.get_ranking_central(p_gestor_id uuid, p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[]; v_result jsonb;
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
    SELECT DISTINCT
           tm.user_id        AS auth_id,
           p.id              AS profile_id,
           p.nome            AS corretor_nome,
           p.avatar_url
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.user_id = ANY(v_team_auth) AND tm.status='ativo'
  ),
  vendas AS (
    SELECT corretor_id AS profile_id,
           COUNT(*)::int AS qtd_vendas,
           SUM(COALESCE(vgv_final,vgv_estimado))::numeric AS vgv
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  vis AS (
    SELECT corretor_id AS auth_id,
           COUNT(*)::int AS visitas_criadas,
           COUNT(*) FILTER (WHERE status='realizada')::int AS visitas_realizadas
    FROM visitas_unicas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  leads AS (
    SELECT corretor_id AS auth_id, COUNT(*)::int AS leads_recebidos
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  oa AS (
    SELECT corretor_id AS auth_id,
           COUNT(*)::int AS oa_tentativas,
           SUM(pontos)::int AS oa_pontos
    FROM oferta_ativa_tentativas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('start',p_start,'end',p_end),
    'corretores', COALESCE(jsonb_agg(jsonb_build_object(
      'corretor_auth_id', b.auth_id,
      'corretor_profile_id', b.profile_id,
      'nome', b.corretor_nome,
      'avatar_url', b.avatar_url,
      'vendas_qtd', COALESCE(v.qtd_vendas,0),
      'vendas_vgv', COALESCE(v.vgv,0),
      'visitas_criadas', COALESCE(vi.visitas_criadas,0),
      'visitas_realizadas', COALESCE(vi.visitas_realizadas,0),
      'leads_recebidos', COALESCE(l.leads_recebidos,0),
      'oa_tentativas', COALESCE(o.oa_tentativas,0),
      'oa_pontos', COALESCE(o.oa_pontos,0)
    ) ORDER BY COALESCE(v.vgv,0) DESC),'[]'::jsonb)
  ) INTO v_result
  FROM base b
  LEFT JOIN vendas v  ON v.profile_id = b.profile_id
  LEFT JOIN vis vi    ON vi.auth_id   = b.auth_id
  LEFT JOIN leads l   ON l.auth_id    = b.auth_id
  LEFT JOIN oa o      ON o.auth_id    = b.auth_id;

  RETURN v_result;
END $function$;

CREATE OR REPLACE FUNCTION public.get_relatorio_equipes(p_gestor_id uuid, p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    FROM visitas_unicas WHERE corretor_id = ANY(v_team_auth) GROUP BY 1),
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

CREATE OR REPLACE FUNCTION public.rpc_perf_dashboard(p_inicio date DEFAULT (((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date - '30 days'::interval), p_fim date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'diretor'::app_role);
  v_is_gestor boolean := has_role(v_uid, 'gestor'::app_role);
  v_ini timestamptz := (p_inicio::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := ((p_fim + 1)::text || ' 00:00:00-03')::timestamptz;
  v_dias_uteis int;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  CREATE TEMP TABLE _perf_universo ON COMMIT DROP AS
  SELECT p.id AS profile_id, p.user_id AS auth_user_id, p.nome
    FROM public.profiles p
   WHERE p.user_id IS NOT NULL
     AND (
       v_is_admin
       OR (v_is_gestor AND EXISTS (
             SELECT 1 FROM public.team_members tm
              WHERE tm.gerente_id = v_uid AND tm.user_id = p.user_id
           ))
       OR p.user_id = v_uid
     );

  SELECT COUNT(*) INTO v_dias_uteis
    FROM generate_series(p_inicio, p_fim, interval '1 day') d
   WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 6
     AND NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.data = d::date);
  v_dias_uteis := GREATEST(v_dias_uteis, 1);

  CREATE TEMP TABLE _perf_metricas ON COMMIT DROP AS
  WITH vgv AS (
    SELECT n.corretor_id AS profile_id,
           COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0) AS vgv_vendido,
           COUNT(*) AS qtd_ganho
      FROM public.negocios n
     WHERE n.fase = 'ganho'
       AND n.data_assinatura BETWEEN p_inicio AND p_fim
     GROUP BY 1
  ), fases AS (
    SELECT n.corretor_id AS profile_id,
           COUNT(*) FILTER (WHERE n.fase = 'contrato')      AS qtd_contrato,
           COUNT(*) FILTER (WHERE n.fase = 'em_negociacao') AS qtd_negociacao
      FROM public.negocios n
     WHERE n.status = 'ativo'
     GROUP BY 1
  ), visitas AS (
    SELECT v.corretor_id AS auth_user_id,
           COUNT(*) FILTER (WHERE v.status = 'realizada') AS qtd_visitas_realizadas,
           COUNT(*) FILTER (WHERE v.status = 'no_show')   AS qtd_no_show,
           COUNT(*) AS qtd_visitas_total
      FROM public.visitas_unicas v
     WHERE v.data_visita BETWEEN p_inicio AND p_fim
     GROUP BY 1
  ), oa AS (
    SELECT t.corretor_id AS auth_user_id,
           COUNT(*) AS qtd_tentativas_oa,
           COUNT(*) FILTER (WHERE t.resultado = 'aproveitado') AS qtd_oa_aproveitados
      FROM public.oferta_ativa_tentativas t
     WHERE t.created_at >= v_ini AND t.created_at < v_fim
     GROUP BY 1
  ), presenca AS (
    SELECT rc.corretor_id AS profile_id,
           COUNT(DISTINCT rc.data) AS dias_presenca
      FROM public.roleta_credenciamentos rc
     WHERE rc.status = 'aprovado'
       AND rc.data BETWEEN p_inicio AND p_fim
     GROUP BY 1
  ), sla AS (
    SELECT pl.corretor_id AS auth_user_id,
           percentile_disc(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (pl.primeiro_contato_em - pl.distribuido_em))/60
           ) AS sla_mediana_min,
           COUNT(*) FILTER (WHERE pl.primeiro_contato_em IS NULL) AS qtd_sem_contato
      FROM public.pipeline_leads pl
     WHERE pl.distribuido_em >= v_ini AND pl.distribuido_em < v_fim
       AND pl.corretor_id IS NOT NULL
     GROUP BY 1
  )
  SELECT u.profile_id, u.auth_user_id, u.nome,
         COALESCE(vgv.vgv_vendido, 0)             AS vgv_vendido,
         COALESCE(vgv.qtd_ganho, 0)               AS qtd_ganho,
         COALESCE(fases.qtd_contrato, 0)          AS qtd_contrato,
         COALESCE(fases.qtd_negociacao, 0)        AS qtd_negociacao,
         COALESCE(visitas.qtd_visitas_realizadas, 0) AS qtd_visitas_realizadas,
         COALESCE(visitas.qtd_no_show, 0)         AS qtd_no_show,
         COALESCE(visitas.qtd_visitas_total, 0)   AS qtd_visitas_total,
         COALESCE(oa.qtd_tentativas_oa, 0)        AS qtd_tentativas_oa,
         COALESCE(oa.qtd_oa_aproveitados, 0)      AS qtd_oa_aproveitados,
         COALESCE(presenca.dias_presenca, 0)      AS dias_presenca,
         ROUND(COALESCE(presenca.dias_presenca, 0)::numeric / v_dias_uteis, 3) AS presenca_pct,
         sla.sla_mediana_min,
         COALESCE(sla.qtd_sem_contato, 0)         AS qtd_sem_contato
    FROM _perf_universo u
    LEFT JOIN vgv      ON vgv.profile_id      = u.profile_id
    LEFT JOIN fases    ON fases.profile_id    = u.profile_id
    LEFT JOIN visitas  ON visitas.auth_user_id = u.auth_user_id
    LEFT JOIN oa       ON oa.auth_user_id      = u.auth_user_id
    LEFT JOIN presenca ON presenca.profile_id = u.profile_id
    LEFT JOIN sla      ON sla.auth_user_id     = u.auth_user_id;

  WITH thresholds AS (
    SELECT jsonb_object_agg(chave, valor) AS t FROM public.perf_thresholds
  ),
  ranking AS (
    SELECT jsonb_agg(row_to_json(m) ORDER BY vgv_vendido DESC, qtd_visitas_realizadas DESC) AS arr
      FROM _perf_metricas m
  ),
  diagnostico AS (
    SELECT jsonb_agg(row_to_json(d)) FILTER (WHERE d.severidade IS NOT NULL) AS arr
      FROM (
        SELECT m.profile_id, m.nome,
               CASE
                 WHEN m.sla_mediana_min > 60*24 THEN 'sla_vermelho'
                 WHEN m.qtd_visitas_total > 0 AND (m.qtd_no_show::numeric/m.qtd_visitas_total) > 0.35 THEN 'no_show_alto'
                 WHEN m.qtd_negociacao > 15 THEN 'wip_negociacao_alto'
                 WHEN m.qtd_tentativas_oa < 5 AND m.dias_presenca > 3 THEN 'baixo_esforco_oa'
                 WHEN m.vgv_vendido = 0 AND m.qtd_visitas_realizadas = 0 THEN 'vgv_zerado'
                 WHEN m.presenca_pct < 0.4 THEN 'presenca_baixa'
                 ELSE NULL
               END AS severidade,
               jsonb_build_object(
                 'vgv_vendido', m.vgv_vendido,
                 'sla_mediana_min', m.sla_mediana_min,
                 'qtd_no_show', m.qtd_no_show,
                 'qtd_tentativas_oa', m.qtd_tentativas_oa,
                 'presenca_pct', m.presenca_pct,
                 'qtd_negociacao', m.qtd_negociacao
               ) AS contexto
          FROM _perf_metricas m
        ORDER BY (m.sla_mediana_min IS NOT NULL)::int DESC, m.vgv_vendido ASC
        LIMIT 3
      ) d
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias_uteis', v_dias_uteis),
    'thresholds', (SELECT t FROM thresholds),
    'ranking', COALESCE((SELECT arr FROM ranking), '[]'::jsonb),
    'diagnostico', COALESCE((SELECT arr FROM diagnostico), '[]'::jsonb),
    'escopo', CASE WHEN v_is_admin THEN 'admin'
                   WHEN v_is_gestor THEN 'gestor'
                   ELSE 'self' END
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_placar_do_dia()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio timestamptz := (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_fim timestamptz := v_inicio + interval '1 day';
  v_result jsonb;
BEGIN
  WITH membros AS (
    SELECT user_id, gerente_id, nome
    FROM public.team_members
    WHERE status = 'ativo' AND user_id IS NOT NULL
  ),
  visitas_marcadas AS (
    SELECT v.id, v.corretor_id, v.created_at AS evento_em, v.created_at,
           v.status, v.nome_cliente, v.data_visita, v.empreendimento,
           m.nome AS corretor_nome, m.gerente_id
    FROM public.visitas_unicas v
    JOIN membros m ON m.user_id = v.corretor_id
    WHERE v.created_at >= v_inicio
      AND v.created_at < v_fim
      AND COALESCE(v.origem, 'manual') NOT LIKE 'backfill_%'
      AND COALESCE(v.origem, 'manual') <> 'auto_stage_move'
  ),
  eventos_realizacao AS (
    SELECT DISTINCT ON (e.visita_id)
           e.visita_id, e.created_at AS evento_em
    FROM public.visita_eventos e
    WHERE e.created_at >= v_inicio
      AND e.created_at < v_fim
      AND e.status_novo = 'realizada'
      AND e.tipo IN ('status_alterado', 'criada')
    ORDER BY e.visita_id, e.created_at ASC
  ),
  visitas_realizadas AS (
    SELECT v.id, v.corretor_id, er.evento_em, v.created_at,
           v.status, v.nome_cliente, v.data_visita, v.empreendimento,
           m.nome AS corretor_nome, m.gerente_id
    FROM eventos_realizacao er
    JOIN public.visitas_unicas v ON v.id = er.visita_id
    JOIN membros m ON m.user_id = v.corretor_id
    WHERE COALESCE(v.origem, 'manual') NOT LIKE 'backfill_%'
      AND COALESCE(v.origem, 'manual') <> 'auto_stage_move'
  )
  SELECT jsonb_build_object(
    'membros',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'gerente_id', gerente_id, 'nome', nome
      )), '[]'::jsonb) FROM membros),
    'visitas_marcadas',
      (SELECT COALESCE(jsonb_agg(to_jsonb(vm) ORDER BY vm.evento_em DESC), '[]'::jsonb)
       FROM visitas_marcadas vm),
    'visitas_realizadas',
      (SELECT COALESCE(jsonb_agg(to_jsonb(vr) ORDER BY vr.evento_em DESC), '[]'::jsonb)
       FROM visitas_realizadas vr),
    'visitas',
      (SELECT COALESCE(jsonb_agg(to_jsonb(vm) ORDER BY vm.evento_em DESC), '[]'::jsonb)
       FROM visitas_marcadas vm),
    'gerado_em', now()
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_visita_conta_mutirao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sessao_id uuid;
  v_profile_id uuid;
  v_nome text;
  v_gerente_auth uuid;
  v_gerente uuid;
  v_equipe text;
BEGIN
  SELECT id INTO v_sessao_id
    FROM public.oferta_ativa_sessoes
   WHERE status = 'ao_vivo' AND inicio_at <= now() AND fim_at >= now()
   ORDER BY inicio_at DESC LIMIT 1;
  IF v_sessao_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.corretor_id IS NULL THEN RETURN NEW; END IF;

  SELECT p.id, p.nome INTO v_profile_id, v_nome
    FROM public.profiles p WHERE p.user_id = NEW.corretor_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT p.id, p.nome INTO v_profile_id, v_nome
      FROM public.profiles p WHERE p.id = NEW.corretor_id LIMIT 1;
  END IF;
  IF v_profile_id IS NULL THEN RETURN NEW; END IF;

  -- Regra SSOT: uma visita por cliente por dia.
  IF EXISTS (
    SELECT 1 FROM public.visitas v2
     WHERE v2.id <> NEW.id
       AND v2.data_visita = NEW.data_visita
       AND COALESCE(v2.pipeline_lead_id::text, lower(btrim(COALESCE(v2.nome_cliente,''))))
           = COALESCE(NEW.pipeline_lead_id::text, lower(btrim(COALESCE(NEW.nome_cliente,''))))
       AND v2.created_at <= NEW.created_at
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.oferta_ativa_ligacoes l
     WHERE l.sessao_id = v_sessao_id
       AND l.corretor_id = v_profile_id
       AND l.resultado = 'visita_agendada'
       AND l.created_at > now() - interval '5 minutes'
       AND (NEW.pipeline_lead_id IS NULL OR l.pipeline_lead_id = NEW.pipeline_lead_id)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT tm.gerente_id INTO v_gerente_auth
    FROM public.team_members tm
   WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo'
   ORDER BY tm.created_at DESC LIMIT 1;

  IF v_gerente_auth IS NOT NULL THEN
    SELECT gp.id, split_part(gp.nome, ' ', 1) INTO v_gerente, v_equipe
      FROM public.profiles gp
     WHERE gp.user_id = v_gerente_auth OR gp.id = v_gerente_auth
     LIMIT 1;
  END IF;

  INSERT INTO public.oferta_ativa_participantes
    (sessao_id, corretor_id, gerente_id, equipe_text, visitas_count, pontos, ultima_acao_at)
  VALUES (v_sessao_id, v_profile_id, v_gerente, v_equipe, 1, 30, now())
  ON CONFLICT (sessao_id, corretor_id) DO UPDATE
    SET visitas_count = public.oferta_ativa_participantes.visitas_count + 1,
        pontos = public.oferta_ativa_participantes.pontos + 30,
        ultima_acao_at = now(),
        updated_at = now();

  INSERT INTO public.oferta_ativa_ligacoes
    (sessao_id, pipeline_lead_id, corretor_id, resultado, pontos, origem, observacao)
  VALUES (v_sessao_id, NEW.pipeline_lead_id, v_profile_id, 'visita_agendada', 30, 'pipeline',
          'Visita marcada fora do mutirão');

  INSERT INTO public.pulse_events (tipo, titulo, descricao, corretor_id, metadata)
  VALUES ('oa_visita',
          COALESCE(v_nome, 'Corretor') || ' agendou uma visita',
          COALESCE(NEW.nome_cliente, 'Cliente') || COALESCE(' · ' || NEW.empreendimento, ''),
          v_profile_id,
          jsonb_build_object('sessao_id', v_sessao_id, 'visita_id', NEW.id, 'origem', 'pipeline'));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_visita_conta_mutirao falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 4) Funções que já usam as views analíticas passam a usar a versão deduplicada
CREATE OR REPLACE FUNCTION public.__noop_visitas_ssot() RETURNS void LANGUAGE sql AS $$ SELECT NULL::void $$;