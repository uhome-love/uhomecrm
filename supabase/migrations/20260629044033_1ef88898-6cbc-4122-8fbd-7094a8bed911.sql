CREATE OR REPLACE FUNCTION public.get_relatorio_metas(
  p_gestor_id uuid,
  p_start date,
  p_end date,
  p_prev_start date DEFAULT NULL::date,
  p_prev_end date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_gerentes uuid[];
  v_meses text[];
  v_core jsonb;
  v_meta_leads int; v_meta_vis int; v_meta_vgv numeric;
  v_meta_ass int; v_meta_neg int; v_meta_aprov int;
  v_r_leads int; v_r_vis int; v_r_vgv numeric;
  v_r_ass int; v_r_neg int; v_r_aprov int;
  v_has_metas boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_gestor_id IS NULL THEN
    IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
    v_gerentes := NULL; -- todas
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
    v_gerentes := ARRAY[p_gestor_id];
  END IF;
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  -- Meses (yyyy-MM) que o range cobre
  v_meses := ARRAY(
    SELECT to_char(d, 'YYYY-MM')
    FROM generate_series(date_trunc('month', p_start), date_trunc('month', p_end), interval '1 month') d
  );

  -- Metas somadas dos meses do range (escopo por gerente)
  SELECT
    COALESCE(SUM(meta_leads),0)::int,
    COALESCE(SUM(meta_visitas_realizadas),0)::int,
    COALESCE(SUM(meta_vgv_assinado),0)::numeric,
    COALESCE(SUM(meta_assinados),0)::int,
    COALESCE(SUM(meta_negocios),0)::int,
    COALESCE(SUM(meta_aproveitados),0)::int,
    COUNT(*) > 0
  INTO v_meta_leads, v_meta_vis, v_meta_vgv, v_meta_ass, v_meta_neg, v_meta_aprov, v_has_metas
  FROM ceo_metas_mensais
  WHERE mes = ANY(v_meses)
    AND (v_gerentes IS NULL OR gerente_id = ANY(v_gerentes));

  -- Realizado via core compartilhado
  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  v_r_leads := COALESCE((v_core->'leads'->>'recebidos')::int, 0);
  v_r_vis   := COALESCE((v_core->'visitas'->>'realizadas')::int, 0);
  v_r_vgv   := COALESCE((v_core->'vendas'->>'vgv')::numeric, 0);
  v_r_ass   := COALESCE((v_core->'vendas'->>'count')::int, 0);
  v_r_neg   := COALESCE((v_core->'negocios'->>'criados')::int, 0);
  v_r_aprov := COALESCE((v_core->'oferta_ativa'->>'aproveitados')::int, 0);

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('start', p_start, 'end', p_end),
    'meses', to_jsonb(v_meses),
    'tem_metas', v_has_metas,
    'metricas', jsonb_build_array(
      jsonb_build_object('id','vgv','label','VGV Assinado','formato','moeda',
        'meta', v_meta_vgv, 'realizado', v_r_vgv,
        'pct', CASE WHEN v_meta_vgv>0 THEN round(v_r_vgv*100.0/v_meta_vgv,1) END),
      jsonb_build_object('id','assinados','label','Vendas Assinadas','formato','numero',
        'meta', v_meta_ass, 'realizado', v_r_ass,
        'pct', CASE WHEN v_meta_ass>0 THEN round(v_r_ass*100.0/v_meta_ass,1) END),
      jsonb_build_object('id','leads','label','Leads Recebidos','formato','numero',
        'meta', v_meta_leads, 'realizado', v_r_leads,
        'pct', CASE WHEN v_meta_leads>0 THEN round(v_r_leads*100.0/v_meta_leads,1) END),
      jsonb_build_object('id','visitas','label','Visitas Realizadas','formato','numero',
        'meta', v_meta_vis, 'realizado', v_r_vis,
        'pct', CASE WHEN v_meta_vis>0 THEN round(v_r_vis*100.0/v_meta_vis,1) END),
      jsonb_build_object('id','negocios','label','Negócios Criados','formato','numero',
        'meta', v_meta_neg, 'realizado', v_r_neg,
        'pct', CASE WHEN v_meta_neg>0 THEN round(v_r_neg*100.0/v_meta_neg,1) END),
      jsonb_build_object('id','aproveitados','label','Aproveitados (Oferta Ativa)','formato','numero',
        'meta', v_meta_aprov, 'realizado', v_r_aprov,
        'pct', CASE WHEN v_meta_aprov>0 THEN round(v_r_aprov*100.0/v_meta_aprov,1) END)
    )
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.get_relatorio_metas(uuid,date,date,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_metas(uuid,date,date,date,date) TO service_role;