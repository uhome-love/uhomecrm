
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
         (count(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end))::int,
         (count(*) FILTER (WHERE fase = 'distrato' AND (fase_changed_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end))::int
  INTO v_neg_ativos, v_neg_criados, v_neg_caidos
  FROM negocios WHERE corretor_id = ANY(p_team_prof);

  IF p_prev_start IS NOT NULL THEN
    SELECT count(*)::int INTO v_neg_criados_prev FROM negocios
     WHERE corretor_id = ANY(p_team_prof)
       AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_prev_start AND p_prev_end;
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
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end;

  SELECT count(*)::int INTO v_oa_ativos_pipe
  FROM pipeline_leads
  WHERE corretor_id = ANY(p_team_auth)
    AND origem IN ('Oferta Ativa', 'oferta_ativa')
    AND arquivado = false;

  SELECT count(*)::int INTO v_oa_neg
  FROM negocios n
  WHERE n.corretor_id = ANY(p_team_prof)
    AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
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
END $function$;

CREATE OR REPLACE FUNCTION public.get_relatorio_oferta_ativa(p_gestor_id uuid, p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_gestor_id IS NULL THEN
    IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
  END IF;
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  WITH t AS (
    SELECT ot.lista_id,
           COALESCE(l.nome,'(sem lista)') AS lista_nome,
           COUNT(*) AS tentativas,
           COUNT(*) FILTER (WHERE ot.resultado='com_interesse') AS aproveitados
    FROM oferta_ativa_tentativas ot
    LEFT JOIN oferta_ativa_listas l ON l.id = ot.lista_id
    WHERE ot.corretor_id = ANY(v_team_auth)
      AND (ot.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY ot.lista_id, l.nome
    ORDER BY tentativas DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'top_listas_origem', COALESCE(jsonb_agg(jsonb_build_object(
      'lista_id', lista_id,
      'lista_nome', lista_nome,
      'tentativas', tentativas,
      'aproveitados', aproveitados,
      'taxa_pct', CASE WHEN tentativas>0
          THEN ROUND((aproveitados::numeric/tentativas)*100,1) ELSE 0 END
    )), '[]'::jsonb)
  ) INTO v_extras FROM t;

  RETURN v_core || jsonb_build_object('extras', v_extras);
END $function$;

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
    IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
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
    FROM visitas
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
