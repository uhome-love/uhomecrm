SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public._kpi_team_window_core(
  p_team_auth   uuid[],
  p_team_prof   uuid[],
  p_start       date,
  p_end         date,
  p_prev_start  date DEFAULT NULL,
  p_prev_end    date DEFAULT NULL,
  p_include_partner_split boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_leads_atual int; v_leads_prev int;
  v_vis_criadas int; v_vis_marcadas int; v_vis_realizadas int; v_vis_noshow int; v_vis_real_prev int;
  v_neg_ativos int; v_neg_criados int; v_neg_caidos int; v_neg_criados_prev int;
  v_vgv numeric; v_vendas_qtd int; v_vgv_prev numeric;
  v_oa_tent int; v_oa_aproveitados int; v_oa_ativos_pipe int; v_oa_neg int;
BEGIN
  IF p_team_auth IS NULL THEN p_team_auth := ARRAY[]::uuid[]; END IF;
  IF p_team_prof IS NULL THEN p_team_prof := ARRAY[]::uuid[]; END IF;

  -- LEADS
  SELECT count(*)::int INTO v_leads_atual FROM pipeline_leads
   WHERE corretor_id = ANY(p_team_auth)
     AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date
         BETWEEN p_start AND p_end;

  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_leads_prev FROM pipeline_leads
     WHERE corretor_id = ANY(p_team_auth)
       AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date
           BETWEEN p_prev_start AND p_prev_end;
  ELSE v_leads_prev := 0; END IF;

  -- VISITAS
  SELECT count(*)::int,
         (count(*) FILTER (WHERE status IN ('marcada','reagendada')))::int,
         (count(*) FILTER (WHERE status = 'realizada'))::int,
         (count(*) FILTER (WHERE status = 'no_show'))::int
  INTO v_vis_criadas, v_vis_marcadas, v_vis_realizadas, v_vis_noshow
  FROM visitas
  WHERE corretor_id = ANY(p_team_auth)
    AND data_visita BETWEEN p_start AND p_end
    AND (tipo IS NULL OR tipo = 'lead');

  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_vis_real_prev FROM visitas
     WHERE corretor_id = ANY(p_team_auth)
       AND data_visita BETWEEN p_prev_start AND p_prev_end
       AND status = 'realizada' AND (tipo IS NULL OR tipo = 'lead');
  ELSE v_vis_real_prev := 0; END IF;

  -- NEGOCIOS
  SELECT (count(*) FILTER (WHERE status = 'ativo'))::int,
         (count(*) FILTER (WHERE created_at::date BETWEEN p_start AND p_end))::int,
         (count(*) FILTER (WHERE fase = 'distrato' AND fase_changed_at::date BETWEEN p_start AND p_end))::int
  INTO v_neg_ativos, v_neg_criados, v_neg_caidos
  FROM negocios WHERE corretor_id = ANY(p_team_prof);

  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_neg_criados_prev FROM negocios
     WHERE corretor_id = ANY(p_team_prof)
       AND created_at::date BETWEEN p_prev_start AND p_prev_end;
  ELSE v_neg_criados_prev := 0; END IF;

  -- VENDAS
  IF p_include_partner_split THEN
    WITH base AS (
      SELECT n.id, n.pipeline_lead_id, n.auth_user_id,
             COALESCE(n.vgv_final, n.vgv_estimado, 0)::numeric AS valor
      FROM negocios n
      WHERE n.fase = 'vendido'
        AND n.data_assinatura BETWEEN p_start AND p_end
        AND (n.corretor_id = ANY(p_team_prof) OR n.auth_user_id = ANY(p_team_auth)
             OR EXISTS (SELECT 1 FROM pipeline_parcerias pp
                        WHERE pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status='ativa'
                          AND (pp.corretor_principal_id = ANY(p_team_auth)
                               OR pp.corretor_parceiro_id = ANY(p_team_auth))))
    ), com_split AS (
      SELECT b.id, b.valor,
        CASE WHEN pp.id IS NOT NULL
                  AND pp.corretor_principal_id = ANY(p_team_auth)
                  AND pp.corretor_parceiro_id = ANY(p_team_auth)
               THEN b.valor
             WHEN pp.id IS NOT NULL AND pp.corretor_principal_id = ANY(p_team_auth)
               THEN (b.valor * COALESCE(pp.divisao_principal, 50) / 100)
             WHEN pp.id IS NOT NULL AND pp.corretor_parceiro_id = ANY(p_team_auth)
               THEN (b.valor * COALESCE(pp.divisao_parceiro, 50) / 100)
             ELSE b.valor END AS valor_split
      FROM base b
      LEFT JOIN pipeline_parcerias pp
        ON pp.pipeline_lead_id = b.pipeline_lead_id AND pp.status = 'ativa'
    )
    SELECT COALESCE(SUM(valor_split), 0), count(*)::int
    INTO v_vgv, v_vendas_qtd FROM com_split;
  ELSE
    SELECT COALESCE(SUM(COALESCE(vgv_final, vgv_estimado, 0)), 0), count(*)::int
    INTO v_vgv, v_vendas_qtd
    FROM negocios
    WHERE corretor_id = ANY(p_team_prof) AND fase = 'vendido'
      AND data_assinatura BETWEEN p_start AND p_end;
  END IF;

  IF p_prev_start IS NOT NULL THEN
    SELECT COALESCE(SUM(COALESCE(vgv_final, vgv_estimado, 0)), 0) INTO v_vgv_prev
    FROM negocios WHERE corretor_id = ANY(p_team_prof) AND fase = 'vendido'
      AND data_assinatura BETWEEN p_prev_start AND p_prev_end;
  ELSE v_vgv_prev := 0; END IF;

  -- OFERTA ATIVA
  SELECT count(*)::int, (count(*) FILTER (WHERE resultado = 'com_interesse'))::int
  INTO v_oa_tent, v_oa_aproveitados
  FROM oferta_ativa_tentativas
  WHERE corretor_id = ANY(p_team_auth)
    AND created_at::date BETWEEN p_start AND p_end;

  SELECT count(*)::int INTO v_oa_ativos_pipe
  FROM pipeline_leads
  WHERE corretor_id = ANY(p_team_auth)
    AND origem IN ('Oferta Ativa', 'oferta_ativa')
    AND arquivado = false;

  SELECT count(*)::int INTO v_oa_neg
  FROM negocios n
  WHERE n.corretor_id = ANY(p_team_prof)
    AND n.created_at::date BETWEEN p_start AND p_end
    AND EXISTS (SELECT 1 FROM pipeline_leads pl
                WHERE pl.id = n.pipeline_lead_id
                  AND pl.origem IN ('Oferta Ativa', 'oferta_ativa'));

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('start', p_start, 'end', p_end,
                                   'prev_start', p_prev_start, 'prev_end', p_prev_end),
    'leads', jsonb_build_object(
       'recebidos', v_leads_atual, 'recebidos_prev', v_leads_prev,
       'delta_pct', CASE WHEN v_leads_prev > 0
                          THEN round((v_leads_atual - v_leads_prev) * 100.0 / v_leads_prev, 1)
                          END),
    'visitas', jsonb_build_object(
       'criadas', v_vis_criadas, 'marcadas', v_vis_marcadas,
       'realizadas', v_vis_realizadas, 'no_show', v_vis_noshow,
       'realizadas_prev', v_vis_real_prev,
       'delta_pct', CASE WHEN v_vis_real_prev > 0
                          THEN round((v_vis_realizadas - v_vis_real_prev) * 100.0 / v_vis_real_prev, 1)
                          END,
       'taxa_comparecimento_pct', CASE WHEN (v_vis_realizadas + v_vis_noshow) > 0
                                        THEN round(v_vis_realizadas * 100.0 / (v_vis_realizadas + v_vis_noshow), 1)
                                        END),
    'negocios', jsonb_build_object(
       'ativos', v_neg_ativos, 'criados', v_neg_criados, 'caidos', v_neg_caidos,
       'criados_prev', v_neg_criados_prev,
       'delta_pct', CASE WHEN v_neg_criados_prev > 0
                          THEN round((v_neg_criados - v_neg_criados_prev) * 100.0 / v_neg_criados_prev, 1)
                          END),
    'vendas', jsonb_build_object(
       'vgv', v_vgv, 'count', v_vendas_qtd, 'vgv_prev', v_vgv_prev,
       'delta_pct', CASE WHEN v_vgv_prev > 0
                          THEN round((v_vgv - v_vgv_prev) * 100.0 / v_vgv_prev, 1)
                          END,
       'ticket_medio', CASE WHEN v_vendas_qtd > 0 THEN round(v_vgv / v_vendas_qtd, 2) END),
    'oferta_ativa', jsonb_build_object(
       'tentativas', v_oa_tent, 'aproveitados', v_oa_aproveitados,
       'ativos_no_pipeline', v_oa_ativos_pipe, 'negocios_da_oa', v_oa_neg,
       'conversao_pct', CASE WHEN v_oa_tent > 0
                              THEN round(v_oa_aproveitados * 100.0 / v_oa_tent, 1)
                              END)
  );
END $$;

GRANT EXECUTE ON FUNCTION public._kpi_team_window_core(
  uuid[], uuid[], date, date, date, date, boolean
) TO authenticated, service_role;