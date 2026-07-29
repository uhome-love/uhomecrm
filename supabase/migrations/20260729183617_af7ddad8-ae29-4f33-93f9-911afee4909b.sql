CREATE OR REPLACE FUNCTION public.rpc_metricas(
  p_start date,
  p_end date,
  p_user_id uuid DEFAULT NULL,
  p_gerente_id uuid DEFAULT NULL,
  p_incluir_inativos boolean DEFAULT true
)
RETURNS TABLE (
  corretor_auth_id uuid,
  corretor_nome text,
  equipe text,
  gerente_auth_id uuid,
  corretor_ativo boolean,
  leads_recebidos bigint,
  visitas_marcadas bigint,
  visitas_realizadas bigint,
  visitas_no_show bigint,
  vendas numeric,
  vgv_assinado numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH vendas AS (
    SELECT v.corretor_auth_id,
           SUM(v.participacao)  AS vendas,
           SUM(v.vgv_rateado)   AS vgv_assinado
    FROM public.v_fato_venda v
    WHERE v.data_assinatura >= p_start
      AND v.data_assinatura <= p_end
      AND v.corretor_auth_id IS NOT NULL
    GROUP BY v.corretor_auth_id
  ),
  visitas AS (
    SELECT vi.corretor_auth_id,
           COUNT(*) FILTER (WHERE vi.conta_marcada AND vi.data_criacao BETWEEN p_start AND p_end) AS visitas_marcadas,
           COUNT(*) FILTER (WHERE vi.conta_realizada AND vi.data_visita BETWEEN p_start AND p_end) AS visitas_realizadas,
           COUNT(*) FILTER (WHERE vi.conta_no_show   AND vi.data_visita BETWEEN p_start AND p_end) AS visitas_no_show
    FROM public.v_fato_visita vi
    WHERE vi.corretor_auth_id IS NOT NULL
      AND (vi.data_criacao BETWEEN p_start AND p_end OR vi.data_visita BETWEEN p_start AND p_end)
    GROUP BY vi.corretor_auth_id
  ),
  leads AS (
    SELECT l.corretor_auth_id, COUNT(*) AS leads_recebidos
    FROM public.v_fato_lead l
    WHERE l.data_entrada BETWEEN p_start AND p_end
      AND l.corretor_auth_id IS NOT NULL
    GROUP BY l.corretor_auth_id
  ),
  base AS (
    SELECT corretor_auth_id FROM vendas
    UNION SELECT corretor_auth_id FROM visitas
    UNION SELECT corretor_auth_id FROM leads
  )
  SELECT b.corretor_auth_id,
         pr.nome,
         ce.equipe,
         ce.gerente_auth_id,
         COALESCE(ce.corretor_ativo, false),
         COALESCE(l.leads_recebidos, 0),
         COALESCE(vi.visitas_marcadas, 0),
         COALESCE(vi.visitas_realizadas, 0),
         COALESCE(vi.visitas_no_show, 0),
         COALESCE(ve.vendas, 0),
         COALESCE(ve.vgv_assinado, 0)
  FROM base b
  LEFT JOIN public.profiles pr ON pr.user_id = b.corretor_auth_id
  LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = b.corretor_auth_id
  LEFT JOIN vendas ve ON ve.corretor_auth_id = b.corretor_auth_id
  LEFT JOIN visitas vi ON vi.corretor_auth_id = b.corretor_auth_id
  LEFT JOIN leads l ON l.corretor_auth_id = b.corretor_auth_id
  WHERE (p_user_id IS NULL OR b.corretor_auth_id = p_user_id)
    AND (p_gerente_id IS NULL OR ce.gerente_auth_id = p_gerente_id)
    AND (p_incluir_inativos OR COALESCE(ce.corretor_ativo, false))
  ORDER BY COALESCE(ve.vgv_assinado, 0) DESC, COALESCE(vi.visitas_realizadas, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_metricas(date, date, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_metricas(date, date, uuid, uuid, boolean) TO service_role;