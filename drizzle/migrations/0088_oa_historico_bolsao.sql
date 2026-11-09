CREATE OR REPLACE FUNCTION public.oa_historico_bolsao()
RETURNS TABLE(lead_id uuid, nome text, telefone text, empreendimento text, porta text, resultado text, quando timestamptz, no_meu_pipeline boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.pipeline_lead_id, pl.nome, pl.telefone, pl.empreendimento, r.porta, r.ultimo_resultado, r.updated_at,
         (r.ultimo_resultado = 'aproveitado' AND pl.corretor_id = auth.uid() AND COALESCE(pl.arquivado,false) = false)
  FROM public.bolsao_reservas r
  JOIN public.pipeline_leads pl ON pl.id = r.pipeline_lead_id
  WHERE r.corretor_id = auth.uid()
    AND r.updated_at >= now() - interval '24 hours'
    AND r.ultimo_resultado IN ('nao_atendeu','sem_interesse','aproveitado')
  ORDER BY r.updated_at DESC
  LIMIT 300
$$;
REVOKE ALL ON FUNCTION public.oa_historico_bolsao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oa_historico_bolsao() TO authenticated, service_role;