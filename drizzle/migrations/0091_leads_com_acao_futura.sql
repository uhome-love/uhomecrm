CREATE OR REPLACE FUNCTION public.leads_com_acao_futura(p_ids uuid[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT DISTINCT v.pipeline_lead_id FROM public.visitas v
   WHERE v.pipeline_lead_id = ANY(p_ids) AND v.status IN ('marcada','confirmada','reagendada')
     AND v.data_visita >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  UNION
  SELECT DISTINCT t.pipeline_lead_id FROM public.pipeline_tarefas t
   WHERE t.pipeline_lead_id = ANY(p_ids) AND t.status = 'pendente'
     AND t.vence_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;
REVOKE ALL ON FUNCTION public.leads_com_acao_futura(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leads_com_acao_futura(uuid[]) TO authenticated, service_role;