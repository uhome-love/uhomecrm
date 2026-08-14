-- REGRA ÚNICA de estagnação = nova saúde do lead (public.lead_saude_status).
-- Antes: get_pipeline_estagnacao usava a régua velha (flag pl.estagnado + config +
-- _pipeline_referencia_estagnacao), que tratava "tem tarefa atrasada" como próximo passo
-- e ESCONDIA estagnados reais. Ex.: Flávio tinha 51 estagnados na carteira dele, mas o
-- gerente Gabriel via ~0 na página. Agora as duas telas espelham a MESMA régua:
--   estagnado = sem_contato >15d | qualificação/aquecimento >21d desde a última atividade.
-- Mesmo ref de rpc_carteira_saude (COALESCE(distribuido_em, created_at)) => classificação
-- idêntica ao que o corretor vê. Escopo por papel preservado (admin/diretor = tudo;
-- gestor = time via team_members). Categorias reduzidas a estagnado | em_parceria.
-- Validado em 14/08/2026: Gabriel vê 51 do Flávio == carteira do Flávio (51). Já em produção.

CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()
 RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, corretor_id uuid, corretor_nome text, dias_limite integer, ultima_acao_humana timestamptz, dias_sem_acao integer, categoria text, estagnado_prazo_em timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT pl.id, pl.nome, pl.empreendimento, s.nome, pl.stage_id, pl.corretor_id, pr.nome,
    CASE s.tipo WHEN 'sem_contato' THEN 15 ELSE 21 END AS dias_limite,
    pl.ultimo_toque_at AS ultima_acao_humana,
    floor(extract(epoch FROM (now() - COALESCE(pl.ultimo_toque_at, pl.distribuido_em, pl.created_at)))/86400)::int AS dias_sem_acao,
    CASE
      WHEN EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa') THEN 'em_parceria'
      ELSE 'estagnado'
    END AS categoria,
    pl.estagnado_prazo_em
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  LEFT JOIN profiles pr ON pr.user_id = pl.corretor_id
  WHERE s.tipo IN ('sem_contato','qualificacao','aquecimento')
    AND COALESCE(pl.arquivado,false) = false
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), s.tipo) = 'estagnado'
    AND (
      public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR (public.has_role(auth.uid(),'gestor') AND pl.corretor_id IN (
            SELECT tm.user_id FROM public.team_members tm WHERE tm.gerente_id = auth.uid() AND tm.status='ativo'))
    )
  ORDER BY dias_sem_acao DESC;
$function$;
