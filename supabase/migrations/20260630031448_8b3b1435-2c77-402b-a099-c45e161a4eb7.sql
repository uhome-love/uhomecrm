CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()
RETURNS TABLE (
  lead_id uuid,
  nome text,
  empreendimento text,
  etapa text,
  stage_id uuid,
  corretor_id uuid,
  corretor_nome text,
  dias_limite integer,
  ultima_acao_humana timestamptz,
  dias_sem_acao integer,
  categoria text,
  estagnado_prazo_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT c.stage_id, c.dias_limite FROM pipeline_estagnacao_config c
  )
  SELECT
    pl.id,
    pl.nome,
    pl.empreendimento,
    s.nome,
    pl.stage_id,
    pl.corretor_id,
    pr.nome,
    cfg.dias_limite,
    public._pipeline_ultima_acao_humana(pl.id) AS ult,
    EXTRACT(day FROM now() - public._pipeline_ultima_acao_humana(pl.id))::int AS dias_sem_acao,
    CASE
      WHEN pl.estagnado THEN 'estagnado'
      WHEN pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em > now() THEN 'em_aviso'
      WHEN EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa') THEN 'em_parceria'
      ELSE 'candidato'
    END AS categoria,
    pl.estagnado_prazo_em
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  JOIN cfg ON cfg.stage_id = pl.stage_id
  LEFT JOIN profiles pr ON pr.id = pl.corretor_id
  WHERE pl.arquivado IS NOT TRUE
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND (
      pl.estagnado = true
      OR pl.estagnado_aviso_em IS NOT NULL
      OR public._pipeline_ultima_acao_humana(pl.id) < now() - (cfg.dias_limite || ' days')::interval
    )
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'diretor')
      OR public.has_role(auth.uid(),'gestor')
    )
  ORDER BY ult ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_estagnacao() TO authenticated, service_role;