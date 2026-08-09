CREATE OR REPLACE FUNCTION public.get_perf_empreendimento(
  p_start date, p_end date, p_gerente_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean; v_is_gestor boolean;
  v_gerente uuid := p_gerente_id; v_user uuid := p_user_id; v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_is_admin := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor');
  v_is_gestor := public.has_role(v_uid,'gestor');
  IF NOT v_is_admin THEN
    IF v_is_gestor THEN v_gerente := v_uid; v_user := NULL;
    ELSE v_user := v_uid; v_gerente := NULL; END IF;
  END IF;

  WITH leads AS (
    SELECT COALESCE(NULLIF(TRIM(empreendimento),''),'Sem empreendimento') emp, count(*) leads
    FROM public.v_fato_lead
    WHERE data_entrada BETWEEN p_start AND p_end AND corretor_auth_id IS NOT NULL
      AND (v_user IS NULL OR corretor_auth_id = v_user)
      AND (v_gerente IS NULL OR gerente_auth_id = v_gerente)
    GROUP BY 1),
  vis AS (
    SELECT COALESCE(NULLIF(TRIM(empreendimento),''),'Sem empreendimento') emp,
           count(*) FILTER (WHERE conta_realizada AND data_visita BETWEEN p_start AND p_end) realizadas
    FROM public.v_fato_visita
    WHERE corretor_auth_id IS NOT NULL
      AND (data_criacao BETWEEN p_start AND p_end OR data_visita BETWEEN p_start AND p_end)
      AND (v_user IS NULL OR corretor_auth_id = v_user)
      AND (v_gerente IS NULL OR gerente_auth_id = v_gerente)
    GROUP BY 1),
  vendas AS (
    SELECT COALESCE(NULLIF(TRIM(empreendimento),''),'Sem empreendimento') emp,
           SUM(participacao) vendas, SUM(vgv_rateado) vgv
    FROM public.v_fato_venda
    WHERE data_assinatura BETWEEN p_start AND p_end AND corretor_auth_id IS NOT NULL
      AND (v_user IS NULL OR corretor_auth_id = v_user)
      AND (v_gerente IS NULL OR gerente_auth_id = v_gerente)
    GROUP BY 1),
  allemp AS (SELECT emp FROM leads UNION SELECT emp FROM vis UNION SELECT emp FROM vendas)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'empreendimento', a.emp,
    'leads', COALESCE(l.leads,0),
    'visitas', COALESCE(v.realizadas,0),
    'vendas', COALESCE(ve.vendas,0),
    'vgv', COALESCE(ve.vgv,0)
  ) ORDER BY COALESCE(l.leads,0) DESC), '[]'::jsonb)
  INTO v_res
  FROM allemp a
  LEFT JOIN leads l ON l.emp = a.emp
  LEFT JOIN vis v ON v.emp = a.emp
  LEFT JOIN vendas ve ON ve.emp = a.emp;

  RETURN COALESCE(v_res, '[]'::jsonb);
END
$function$;

GRANT EXECUTE ON FUNCTION public.get_perf_empreendimento(date,date,uuid,uuid) TO authenticated;