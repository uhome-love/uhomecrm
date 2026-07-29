CREATE OR REPLACE FUNCTION public.rpc_metricas_origem(
  p_start date,
  p_end date,
  p_gerente_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  origem text,
  campanha text,
  leads bigint,
  visitas_marcadas bigint,
  visitas_realizadas bigint,
  vendas numeric,
  vgv_assinado numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH leads AS (
    SELECT l.lead_id,
           COALESCE(NULLIF(btrim(l.origem), ''), 'Sem origem')   AS origem,
           COALESCE(NULLIF(btrim(l.campanha), ''), 'Sem campanha') AS campanha
    FROM public.v_fato_lead l
    LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = l.corretor_auth_id
    WHERE l.data_entrada BETWEEN p_start AND p_end
      AND (p_gerente_id IS NULL OR ce.gerente_auth_id = p_gerente_id)
  ),
  vis AS (
    SELECT vi.pipeline_lead_id,
           COUNT(*) FILTER (WHERE vi.conta_marcada)   AS marcadas,
           COUNT(*) FILTER (WHERE vi.conta_realizada) AS realizadas
    FROM public.v_fato_visita vi
    WHERE vi.pipeline_lead_id IN (SELECT lead_id FROM leads)
    GROUP BY vi.pipeline_lead_id
  ),
  ven AS (
    SELECT v.pipeline_lead_id,
           SUM(v.participacao) AS vendas,
           SUM(v.vgv_rateado)  AS vgv
    FROM public.v_fato_venda v
    WHERE v.pipeline_lead_id IN (SELECT lead_id FROM leads)
    GROUP BY v.pipeline_lead_id
  )
  SELECT l.origem,
         l.campanha,
         COUNT(*)::bigint                       AS leads,
         COALESCE(SUM(vi.marcadas), 0)::bigint  AS visitas_marcadas,
         COALESCE(SUM(vi.realizadas), 0)::bigint AS visitas_realizadas,
         COALESCE(SUM(ve.vendas), 0)::numeric   AS vendas,
         COALESCE(SUM(ve.vgv), 0)::numeric      AS vgv_assinado
  FROM leads l
  LEFT JOIN vis vi ON vi.pipeline_lead_id = l.lead_id
  LEFT JOIN ven ve ON ve.pipeline_lead_id = l.lead_id
  GROUP BY l.origem, l.campanha
  ORDER BY 7 DESC, 3 DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_metricas_origem(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_metricas_origem(date, date, uuid) TO service_role;