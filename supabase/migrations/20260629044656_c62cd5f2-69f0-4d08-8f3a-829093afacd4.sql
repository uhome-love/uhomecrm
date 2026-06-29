CREATE OR REPLACE FUNCTION public.get_relatorio_sla(p_gestor_id uuid, p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[];
  v_result jsonb;
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

  WITH base AS (
    SELECT pl.id,
           pl.distribuido_em,
           pl.aceito_em,
           (SELECT min(a.created_at) FROM pipeline_atividades a
              WHERE a.pipeline_lead_id = pl.id
                AND a.tipo IN ('whatsapp','ligacao','contato','email','followup','visita')
                AND a.created_at >= pl.distribuido_em) AS primeiro_contato
    FROM pipeline_leads pl
    WHERE pl.corretor_id = ANY(v_team_auth)
      AND pl.distribuido_em IS NOT NULL
      AND (pl.distribuido_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
  ),
  calc AS (
    SELECT *,
      CASE WHEN aceito_em >= distribuido_em THEN EXTRACT(EPOCH FROM aceito_em - distribuido_em)/60 END AS min_aceite,
      CASE WHEN primeiro_contato IS NOT NULL THEN EXTRACT(EPOCH FROM primeiro_contato - distribuido_em)/60 END AS min_contato
    FROM base
  )
  SELECT jsonb_build_object(
    'distribuidos', COUNT(*),
    'aceitos', COUNT(min_aceite),
    'contatados', COUNT(min_contato),
    'taxa_contato', CASE WHEN COUNT(*)>0 THEN round(COUNT(min_contato)::numeric*100/COUNT(*),1) ELSE 0 END,
    'aceite_avg_min', round(avg(min_aceite)::numeric,1),
    'aceite_med_min', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY min_aceite)::numeric,1),
    'contato_avg_min', round(avg(min_contato)::numeric,1),
    'contato_med_min', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY min_contato)::numeric,1),
    'faixas', jsonb_build_object(
      'ate5', COUNT(*) FILTER (WHERE min_contato < 5),
      'de5a30', COUNT(*) FILTER (WHERE min_contato >= 5 AND min_contato < 30),
      'de30a120', COUNT(*) FILTER (WHERE min_contato >= 30 AND min_contato < 120),
      'mais120', COUNT(*) FILTER (WHERE min_contato >= 120),
      'sem_contato', COUNT(*) FILTER (WHERE min_contato IS NULL)
    )
  ) INTO v_result FROM calc;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_relatorio_cohort(p_gestor_id uuid, p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[];
  v_cohorts jsonb;
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

  WITH base AS (
    SELECT to_char(date_trunc('month', pl.created_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') AS mes,
           pl.id,
           EXISTS(SELECT 1 FROM pipeline_atividades a WHERE a.pipeline_lead_id=pl.id
                   AND a.tipo IN ('whatsapp','ligacao','contato','email','followup','visita')) AS contatado,
           EXISTS(SELECT 1 FROM visitas v WHERE v.pipeline_lead_id=pl.id) AS com_visita,
           (pl.negocio_id IS NOT NULL) AS convertido
    FROM pipeline_leads pl
    WHERE pl.corretor_id = ANY(v_team_auth)
      AND (pl.created_at AT TIME ZONE 'America/Sao_Paulo') >= date_trunc('month', (p_end::timestamp)) - interval '5 months'
      AND (pl.created_at AT TIME ZONE 'America/Sao_Paulo') < date_trunc('month', (p_end::timestamp)) + interval '1 month'
  )
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.mes) INTO v_cohorts
  FROM (
    SELECT mes,
           COUNT(*) AS leads,
           COUNT(*) FILTER (WHERE contatado) AS contatados,
           COUNT(*) FILTER (WHERE com_visita) AS com_visita,
           COUNT(*) FILTER (WHERE convertido) AS convertidos,
           CASE WHEN COUNT(*)>0 THEN round(COUNT(*) FILTER (WHERE contatado)::numeric*100/COUNT(*),1) ELSE 0 END AS pct_contato,
           CASE WHEN COUNT(*)>0 THEN round(COUNT(*) FILTER (WHERE com_visita)::numeric*100/COUNT(*),1) ELSE 0 END AS pct_visita,
           CASE WHEN COUNT(*)>0 THEN round(COUNT(*) FILTER (WHERE convertido)::numeric*100/COUNT(*),1) ELSE 0 END AS pct_conversao
    FROM base
    GROUP BY mes
  ) t;

  RETURN jsonb_build_object('cohorts', COALESCE(v_cohorts, '[]'::jsonb));
END;
$function$;