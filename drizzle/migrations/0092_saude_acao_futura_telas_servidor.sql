CREATE OR REPLACE FUNCTION public.lead_saude_acao(p_lead_id uuid, p_ultimo_toque timestamptz, p_ref timestamptz, p_stage_tipo text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.lead_tem_acao_futura(p_lead_id) THEN 'verde'
         ELSE public.lead_saude_status(p_ultimo_toque, p_ref, p_stage_tipo) END;
$$;
CREATE OR REPLACE FUNCTION public.lead_saude_acao(p_lead_id uuid, p_ultimo_toque timestamptz, p_ref timestamptz, p_stage_tipo text, p_carencia_ate date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.lead_tem_acao_futura(p_lead_id) THEN 'verde'
         ELSE public.lead_saude_status(p_ultimo_toque, p_ref, p_stage_tipo, p_carencia_ate) END;
$$;
REVOKE ALL ON FUNCTION public.lead_saude_acao(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_saude_acao(uuid, timestamptz, timestamptz, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_saude_acao(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lead_saude_acao(uuid, timestamptz, timestamptz, text, date) TO authenticated, service_role;

DO $$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT p.oid, p.proname,
      CASE p.proname WHEN 'get_pipeline_estagnacao' THEN 'b' WHEN 'homi_dossie_lead' THEN 'l' ELSE 'pl' END AS al
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('get_pipeline_equipes_overview','contar_leads_vermelhos','rpc_carteira_saude','get_pipeline_estagnacao','get_elegibilidade_roleta','get_dashboard_gerente_cockpit','detectar_leads_parados','homi_dossie_lead')
  LOOP
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'public.lead_saude_status(', 'public.lead_saude_acao(' || r.al || '.id, ');
    EXECUTE d;
  END LOOP;
END $$;