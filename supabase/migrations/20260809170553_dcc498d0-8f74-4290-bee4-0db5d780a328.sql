CREATE OR REPLACE FUNCTION public.rpc_perf_funil(
  p_start date,
  p_end date,
  p_gerente_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  corretor_auth_id uuid,
  corretor_nome text,
  avatar_url text,
  equipe text,
  equipe_atual text,
  gerente_auth_id uuid,
  corretor_ativo boolean,
  presenca_dias integer,
  dias_uteis integer,
  leads_recebidos bigint,
  pipeline_ativo bigint,
  descartes bigint,
  visitas_agendadas bigint,
  visitas_realizadas bigint,
  visitas_no_show bigint,
  negocios_abertos bigint,
  vgv_gerado numeric,
  vendas numeric,
  vgv_assinado numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_gestor boolean;
  v_gerente uuid := p_gerente_id;
  v_user uuid := p_user_id;
  v_dias_uteis integer;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  v_is_admin := public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'diretor');
  v_is_gestor := public.has_role(v_uid, 'gestor');

  IF NOT v_is_admin THEN
    IF v_is_gestor THEN
      v_gerente := v_uid;
    ELSE
      v_user := v_uid;
      v_gerente := NULL;
    END IF;
  END IF;

  SELECT COUNT(*)::int INTO v_dias_uteis
  FROM generate_series(p_start, p_end, interval '1 day') d
  WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
    AND NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.data = d::date);

  RETURN QUERY
  WITH m AS (
    SELECT * FROM public.rpc_metricas(p_start, p_end, v_user, v_gerente, true)
  ),
  pres AS (
    SELECT p.user_id AS auth_id,
           COUNT(DISTINCT rp.data) FILTER (WHERE rp.status = 'na_empresa')::int AS dias
    FROM public.roleta_presencas rp
    JOIN public.profiles p ON p.id = rp.corretor_id
    WHERE rp.data BETWEEN p_start AND p_end
    GROUP BY p.user_id
  ),
  pipe AS (
    SELECT pl.corretor_id AS auth_id, COUNT(*) AS total
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages st ON st.id = pl.stage_id
    WHERE pl.corretor_id IS NOT NULL
      AND COALESCE(pl.arquivado, false) = false
      AND st.tipo NOT IN ('venda', 'caiu', 'descarte')
    GROUP BY pl.corretor_id
  ),
  desc_periodo AS (
    SELECT pl.corretor_id AS auth_id, COUNT(DISTINCT ph.pipeline_lead_id) AS total
    FROM public.pipeline_historico ph
    JOIN public.pipeline_stages st ON st.id = ph.stage_novo_id
    JOIN public.pipeline_leads pl ON pl.id = ph.pipeline_lead_id
    WHERE st.tipo IN ('caiu', 'descarte')
      AND (ph.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
      AND pl.corretor_id IS NOT NULL
    GROUP BY pl.corretor_id
  ),
  neg AS (
    SELECT pf.user_id AS auth_id,
           COUNT(*) AS total,
           COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0) AS vgv
    FROM public.negocios n
    JOIN public.profiles pf ON pf.id = n.corretor_id
    WHERE (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY pf.user_id
  )
  SELECT
    m.corretor_auth_id,
    m.corretor_nome,
    pr.avatar_url,
    m.equipe,
    m.equipe_atual,
    m.gerente_auth_id,
    m.corretor_ativo,
    CASE WHEN m.equipe IS NOT DISTINCT FROM m.equipe_atual THEN COALESCE(pres.dias, 0) ELSE 0 END,
    v_dias_uteis,
    m.leads_recebidos,
    CASE WHEN m.equipe IS NOT DISTINCT FROM m.equipe_atual THEN COALESCE(pipe.total, 0) ELSE 0 END,
    CASE WHEN m.equipe IS NOT DISTINCT FROM m.equipe_atual THEN COALESCE(desc_periodo.total, 0) ELSE 0 END,
    m.visitas_agendadas,
    m.visitas_realizadas,
    m.visitas_no_show,
    CASE WHEN m.equipe IS NOT DISTINCT FROM m.equipe_atual THEN COALESCE(neg.total, 0) ELSE 0 END,
    CASE WHEN m.equipe IS NOT DISTINCT FROM m.equipe_atual THEN COALESCE(neg.vgv, 0) ELSE 0 END,
    m.vendas,
    m.vgv_assinado
  FROM m
  LEFT JOIN public.profiles pr ON pr.user_id = m.corretor_auth_id
  LEFT JOIN pres ON pres.auth_id = m.corretor_auth_id
  LEFT JOIN pipe ON pipe.auth_id = m.corretor_auth_id
  LEFT JOIN desc_periodo ON desc_periodo.auth_id = m.corretor_auth_id
  LEFT JOIN neg ON neg.auth_id = m.corretor_auth_id
  ORDER BY m.vgv_assinado DESC, m.visitas_realizadas DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_perf_funil(date, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_perf_funil(date, date, uuid, uuid) TO authenticated;