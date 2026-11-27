CREATE OR REPLACE FUNCTION public.lead_estagnado_vai_fila_ceo(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages s ON s.id = pl.stage_id
    WHERE pl.id = p_lead_id
      AND pl.corretor_id IS NOT NULL
      AND coalesce(pl.is_teste, false) = false
      AND coalesce(pl.arquivado, false) = false
      AND coalesce(pl.modulo_atual,'') <> 'pos_vendas'
      AND s.tipo IN ('novo_lead','sem_contato','qualificacao','aquecimento','pos_visita')
      AND pl.negocio_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.negocios n WHERE n.pipeline_lead_id = pl.id)
      AND NOT EXISTS (SELECT 1 FROM public.visitas v WHERE v.pipeline_lead_id = pl.id AND v.status = 'marcada')
      AND NOT EXISTS (SELECT 1 FROM public.pipeline_parcerias pp WHERE pp.pipeline_lead_id = pl.id AND pp.status = 'ativa')
      AND (
        (pl.estagnado IS TRUE AND pl.estagnado_em IS NOT NULL)
        OR (s.tipo IN ('sem_contato','qualificacao','aquecimento')
            AND public.lead_saude_acao(pl.id, pl.ultimo_toque_at, coalesce(pl.distribuido_em, pl.created_at), s.tipo, pl.estagnacao_carencia_ate) = 'estagnado')
      )
  );
$$;
REVOKE ALL ON FUNCTION public.lead_estagnado_vai_fila_ceo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_estagnado_vai_fila_ceo(uuid) TO service_role;