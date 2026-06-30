CREATE OR REPLACE FUNCTION public.get_corretor_pre_estagnacao()
RETURNS TABLE(
  lead_id uuid,
  nome text,
  empreendimento text,
  etapa text,
  stage_id uuid,
  dias_limite integer,
  dias_sem_acao integer,
  prazo_em timestamp with time zone,
  categoria text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT c.stage_id, c.dias_limite
    FROM pipeline_estagnacao_config c
    WHERE c.ativo = true
  )
  SELECT
    pl.id,
    pl.nome,
    pl.empreendimento,
    s.nome,
    pl.stage_id,
    COALESCE(cfg.dias_limite, 7) AS dias_limite,
    EXTRACT(day FROM now() - public._pipeline_ultima_acao_humana(pl.id))::int AS dias_sem_acao,
    CASE
      WHEN pl.estagnado_aviso_em IS NOT NULL THEN pl.estagnado_prazo_em
      ELSE public._pipeline_ultima_acao_humana(pl.id) + (COALESCE(cfg.dias_limite, 7) || ' days')::interval
    END AS prazo_em,
    CASE
      WHEN pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em > now() THEN 'em_aviso'
      ELSE 'proximo'
    END AS categoria
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  JOIN cfg ON cfg.stage_id = pl.stage_id
  WHERE pl.corretor_id = auth.uid()
    AND pl.estagnado IS NOT TRUE
    AND pl.arquivado IS NOT TRUE
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
    AND NOT EXISTS (
      SELECT 1 FROM pipeline_parcerias pp
      WHERE pp.pipeline_lead_id = pl.id AND pp.status = 'ativa'
    )
    AND (
      pl.estagnado_aviso_em IS NOT NULL
      OR public._pipeline_ultima_acao_humana(pl.id) < now() - ((cfg.dias_limite - 2) || ' days')::interval
    )
  ORDER BY prazo_em ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_corretor_pre_estagnacao() TO authenticated;