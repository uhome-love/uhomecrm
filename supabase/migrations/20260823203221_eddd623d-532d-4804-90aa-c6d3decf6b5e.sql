DROP FUNCTION IF EXISTS public.get_pipeline_estagnacao();

CREATE FUNCTION public.get_pipeline_estagnacao()
RETURNS TABLE(
  lead_id uuid,
  nome text,
  empreendimento text,
  etapa text,
  stage_id uuid,
  corretor_id uuid,
  corretor_nome text,
  dias_limite integer,
  ultima_acao_humana timestamp with time zone,
  dias_sem_acao integer,
  categoria text,
  estagnado_prazo_em timestamp with time zone,
  motivo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT pl.*, s.tipo AS stage_tipo, s.nome AS stage_nome
      FROM pipeline_leads pl
      JOIN pipeline_stages s ON s.id = pl.stage_id
     WHERE pl.negocio_id IS NULL
       AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
       AND s.tipo NOT IN ('venda','caiu','descarte','convertido')
       AND (
         public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
         OR (public.has_role(auth.uid(),'gestor') AND pl.corretor_id IN (
               SELECT tm.user_id FROM public.team_members tm
                WHERE tm.gerente_id = auth.uid() AND tm.status='ativo'))
       )
  )
  SELECT * FROM (
    -- (1) Marcados pelo sistema (cadência Sem Contato) — aguardando decisão
    SELECT b.id AS lead_id, b.nome AS nome, b.empreendimento AS empreendimento, b.stage_nome AS etapa,
      b.stage_id AS stage_id, b.corretor_id AS corretor_id, pr.nome AS corretor_nome,
      CASE b.stage_tipo WHEN 'sem_contato' THEN 15 ELSE 21 END AS dias_limite,
      b.ultimo_toque_at AS ultima_acao_humana,
      floor(extract(epoch FROM (now() - COALESCE(b.ultimo_toque_at, b.distribuido_em, b.created_at)))/86400)::int AS dias_sem_acao,
      CASE
        WHEN EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=b.id AND pp.status='ativa') THEN 'em_parceria'
        ELSE 'aguardando_decisao'
      END AS categoria,
      b.estagnado_prazo_em AS estagnado_prazo_em,
      CASE
        WHEN EXISTS (SELECT 1 FROM lead_cadencia_sem_contato c
                      WHERE c.pipeline_lead_id = b.id AND c.status = 'concluida')
          THEN 'Cadência Sem Contato esgotada (T7 sem retorno)'
        ELSE 'Tarefa da cadência atrasada há 48h'
      END AS motivo
    FROM base b
    LEFT JOIN profiles pr ON pr.user_id = b.corretor_id
    WHERE b.estagnado IS TRUE AND b.estagnado_em IS NOT NULL

    UNION ALL

    -- (2) Estagnados por inatividade (régua de saúde por toque)
    SELECT b.id, b.nome, b.empreendimento, b.stage_nome, b.stage_id, b.corretor_id, pr.nome,
      CASE b.stage_tipo WHEN 'sem_contato' THEN 15 ELSE 21 END AS dias_limite,
      b.ultimo_toque_at,
      floor(extract(epoch FROM (now() - COALESCE(b.ultimo_toque_at, b.distribuido_em, b.created_at)))/86400)::int,
      CASE
        WHEN EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=b.id AND pp.status='ativa') THEN 'em_parceria'
        ELSE 'estagnado'
      END,
      b.estagnado_prazo_em,
      floor(extract(epoch FROM (now() - COALESCE(b.ultimo_toque_at, b.distribuido_em, b.created_at)))/86400)::int
        || ' dias sem toque'
    FROM base b
    LEFT JOIN profiles pr ON pr.user_id = b.corretor_id
    WHERE b.estagnado IS NOT TRUE
      AND COALESCE(b.arquivado,false) = false
      AND b.stage_tipo IN ('sem_contato','qualificacao','aquecimento')
      AND public.lead_saude_status(b.ultimo_toque_at, COALESCE(b.distribuido_em, b.created_at), b.stage_tipo, b.estagnacao_carencia_ate) = 'estagnado'
  ) t
  ORDER BY t.dias_sem_acao DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_estagnacao() TO authenticated;