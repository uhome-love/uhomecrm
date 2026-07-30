CREATE OR REPLACE FUNCTION public.get_relatorio_visitas(p_gestor_id uuid, p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
  v_por_dia jsonb; v_por_emp jsonb;
  v_agendadas int; v_a_realizar int; v_realizadas int; v_no_show int; v_real_prev int;
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

  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  -- ── Visitas: fonte única v_fato_visita (mesma regra do rpc_metricas) ──
  SELECT
    COUNT(*) FILTER (WHERE conta_marcada    AND data_criacao BETWEEN p_start AND p_end)::int,
    COUNT(*) FILTER (WHERE conta_a_realizar AND data_criacao BETWEEN p_start AND p_end)::int,
    COUNT(*) FILTER (WHERE conta_realizada  AND data_visita  BETWEEN p_start AND p_end)::int,
    COUNT(*) FILTER (WHERE conta_no_show    AND data_visita  BETWEEN p_start AND p_end)::int
  INTO v_agendadas, v_a_realizar, v_realizadas, v_no_show
  FROM v_fato_visita
  WHERE corretor_auth_id = ANY(v_team_auth)
    AND (data_criacao BETWEEN p_start AND p_end OR data_visita BETWEEN p_start AND p_end);

  IF p_prev_start IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_real_prev
    FROM v_fato_visita
    WHERE corretor_auth_id = ANY(v_team_auth)
      AND conta_realizada AND data_visita BETWEEN p_prev_start AND p_prev_end;
  ELSE v_real_prev := 0; END IF;

  v_core := jsonb_set(v_core, '{visitas}', jsonb_build_object(
    'agendadas', v_agendadas,
    'criadas', v_agendadas,
    'marcadas', v_agendadas,
    'a_realizar', v_a_realizar,
    'realizadas', v_realizadas,
    'no_show', v_no_show,
    'realizadas_prev', v_real_prev,
    'delta_pct', CASE WHEN v_real_prev > 0 THEN round((v_realizadas - v_real_prev) * 100.0 / v_real_prev, 1) END,
    'taxa_comparecimento_pct', CASE WHEN (v_realizadas + v_no_show) > 0
        THEN round(v_realizadas * 100.0 / (v_realizadas + v_no_show), 1) END
  ));

  SELECT COALESCE(jsonb_object_agg(dow::text, qtd),'{}'::jsonb) INTO v_por_dia
  FROM (
    SELECT EXTRACT(DOW FROM data_visita)::int AS dow, COUNT(*) AS qtd
    FROM v_fato_visita
    WHERE corretor_auth_id = ANY(v_team_auth)
      AND conta_realizada
      AND data_visita BETWEEN p_start AND p_end
    GROUP BY 1
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'empreendimento', empreendimento,
           'criadas', agendadas,
           'agendadas', agendadas,
           'realizadas', realizadas)),'[]'::jsonb) INTO v_por_emp
  FROM (
    SELECT COALESCE(NULLIF(TRIM(empreendimento),''),'Sem empreendimento') AS empreendimento,
           COUNT(*) FILTER (WHERE conta_marcada   AND data_criacao BETWEEN p_start AND p_end) AS agendadas,
           COUNT(*) FILTER (WHERE conta_realizada AND data_visita  BETWEEN p_start AND p_end) AS realizadas
    FROM v_fato_visita
    WHERE corretor_auth_id = ANY(v_team_auth)
      AND (data_criacao BETWEEN p_start AND p_end OR data_visita BETWEEN p_start AND p_end)
    GROUP BY 1
    ORDER BY 2 DESC, 3 DESC
    LIMIT 10
  ) e;

  v_extras := jsonb_build_object('por_dia_semana', v_por_dia, 'por_empreendimento', v_por_emp);
  RETURN v_core || jsonb_build_object('extras', v_extras);
END;
$function$;