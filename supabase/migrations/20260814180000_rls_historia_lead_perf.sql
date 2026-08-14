-- PERF: História do lead levava 15-20s pra carregar (o gerente lia isso como
-- "a história sumiu" ao mover o lead pra etapa de negócio — na verdade era o
-- estado vazio durante o carregamento lento).
--
-- Causa: as políticas RLS de SELECT de pipeline_atividades (pa_select_scoped) e
-- pipeline_tarefas (pt_select_scoped) usavam um subquery NÃO correlacionado
--   pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE corretor_id = auth.uid())
-- Ao ler pipeline_leads dentro da policy, a RLS pesada de pipeline_leads (funções
-- is_my_partner_lead / is_lead_in_my_team por linha) era reavaliada, forçando um
-- SEQ SCAN da tabela inteira (~400MB, 50k páginas) a CADA leitura, mesmo filtrando
-- por 1 lead. Medido: 543ms por query (cache quente) — sob cache frio + 4 tabelas
-- em paralelo + concorrência = os 15-20s.
--
-- Correção: trocar o IN(subquery) pelo EXISTS CORRELACIONADO (mesma semântica,
-- padrão que pipeline_anotacoes/pipeline_historico já usavam) — o planner resolve
-- por index scan na PK (1 linha). Medido depois: 543ms -> 3ms (181x).
-- Nenhuma mudança de quem-vê-o-quê: continua "vejo se sou dono do lead".

ALTER POLICY pa_select_scoped ON public.pipeline_atividades
USING (
  has_role(auth.uid(),'admin')
  OR responsavel_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.id = pipeline_atividades.pipeline_lead_id AND pl.corretor_id = auth.uid())
  OR responsavel_id IN (SELECT tm.user_id FROM public.team_members tm WHERE tm.gerente_id = auth.uid() AND tm.status='ativo')
);

ALTER POLICY pt_select_scoped ON public.pipeline_tarefas
USING (
  has_role(auth.uid(),'admin')
  OR responsavel_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.id = pipeline_tarefas.pipeline_lead_id AND pl.corretor_id = auth.uid())
  OR responsavel_id IN (SELECT tm.user_id FROM public.team_members tm WHERE tm.gerente_id = auth.uid() AND tm.status='ativo')
);

-- Mesmo padrão lento nas policies de escrita de tarefas (concluir/apagar tarefa).
ALTER POLICY "Corretores can update tasks on their leads" ON public.pipeline_tarefas
USING (EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.id = pipeline_tarefas.pipeline_lead_id AND pl.corretor_id = auth.uid()));

ALTER POLICY "Corretores can delete tasks on their leads" ON public.pipeline_tarefas
USING (EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.id = pipeline_tarefas.pipeline_lead_id AND pl.corretor_id = auth.uid()));
