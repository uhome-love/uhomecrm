CREATE OR REPLACE FUNCTION public.rpc_carteira_saude(p_gerente_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_is_admin boolean; v_is_gestor boolean;
  v_gerente uuid := p_gerente_id; v_user uuid := p_user_id; v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  v_is_admin := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor');
  v_is_gestor := public.has_role(v_uid,'gestor');
  IF NOT v_is_admin THEN
    IF v_is_gestor THEN v_gerente := v_uid; v_user := NULL;
    ELSE v_user := v_uid; v_gerente := NULL; END IF;
  END IF;
  WITH team AS (
    SELECT user_id FROM public.team_members
    WHERE status='ativo' AND (v_gerente IS NULL OR gerente_id = v_gerente)),
  base AS (
    SELECT public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), st.tipo) AS saude
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages st ON st.id = pl.stage_id
    WHERE COALESCE(pl.arquivado,false)=false AND st.pipeline_tipo='leads'
      AND st.tipo NOT IN ('venda','caiu','descarte','convertido')
      AND ((v_user IS NOT NULL AND pl.corretor_id = v_user)
           OR (v_user IS NULL AND pl.corretor_id IN (SELECT user_id FROM team))))
  SELECT jsonb_build_object(
    'total', count(*),
    'ativos', count(*) FILTER (WHERE saude <> 'estagnado'),
    'em_dia', count(*) FILTER (WHERE saude='verde'),
    'atencao', count(*) FILTER (WHERE saude='ambar'),
    'desatualizado', count(*) FILTER (WHERE saude='vermelho'),
    'estagnado', count(*) FILTER (WHERE saude='estagnado'),
    'pct_em_dia', round(100.0*count(*) FILTER (WHERE saude='verde')/NULLIF(count(*) FILTER (WHERE saude<>'estagnado'),0),1)
  ) INTO v_res FROM base;
  RETURN COALESCE(v_res,'{}'::jsonb);
END $fn$;