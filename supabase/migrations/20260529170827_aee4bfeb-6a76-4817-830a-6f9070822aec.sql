CREATE OR REPLACE FUNCTION public.get_relatorio_pipeline_leads(
  p_gestor_id uuid, p_start date, p_end date,
  p_prev_start date DEFAULT NULL, p_prev_end date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
  v_pipeline_ativo int; v_total_ativos int; v_atualizados_48h int;
  v_leads_com_visita int;
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
  SELECT COUNT(*) INTO v_pipeline_ativo
  FROM pipeline_leads pl
  JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(v_team_auth)
    AND COALESCE(pl.arquivado,false) = false
    AND ps.pipeline_tipo = 'leads'
    AND ps.tipo NOT IN ('convertido', 'descarte');
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE pl.ultima_acao_at >= now() - interval '48 hours')
    INTO v_total_ativos, v_atualizados_48h
  FROM pipeline_leads pl
  JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(v_team_auth)
    AND COALESCE(pl.arquivado,false) = false
    AND ps.pipeline_tipo = 'leads'
    AND ps.tipo NOT IN ('convertido', 'descarte');
  SELECT COUNT(DISTINCT v.pipeline_lead_id) INTO v_leads_com_visita
  FROM visitas v
  WHERE v.corretor_id = ANY(v_team_auth)
    AND v.data_visita BETWEEN p_start AND p_end
    AND v.pipeline_lead_id IS NOT NULL;
  v_extras := jsonb_build_object(
    'pipeline_ativo', v_pipeline_ativo,
    'taxa_atualizacao_48h', CASE WHEN v_total_ativos>0
        THEN ROUND((v_atualizados_48h::numeric / v_total_ativos)*100, 1) ELSE NULL END,
    'leads_com_visita_periodo', v_leads_com_visita,
    'conversao_lead_visita_pct', CASE WHEN (v_core->'leads'->>'recebidos')::int > 0
        THEN ROUND((v_leads_com_visita::numeric /
              (v_core->'leads'->>'recebidos')::int)*100, 1) ELSE NULL END
  );
  RETURN v_core || jsonb_build_object('extras', v_extras);
END $$;
GRANT EXECUTE ON FUNCTION public.get_relatorio_pipeline_leads(uuid,date,date,date,date) TO authenticated;