CREATE OR REPLACE FUNCTION public.atividade_site_lead(p_lead_id uuid)
RETURNS TABLE(id uuid, tipo text, dados jsonb, pagina text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_lead(p_lead_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT e.id, e.tipo::text, COALESCE(e.dados,'{}'::jsonb)::jsonb, e.pagina::text, e.created_at
    FROM public.site_events e
    WHERE e.pipeline_lead_id = p_lead_id
      AND e.tipo IN ('visitou_imovel','buscou_ia','clicou_contato','formulario_enviado','historico_site','favoritou_imovel')
    ORDER BY e.created_at DESC
    LIMIT 300;
END $$;
REVOKE ALL ON FUNCTION public.atividade_site_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atividade_site_lead(uuid) TO authenticated;