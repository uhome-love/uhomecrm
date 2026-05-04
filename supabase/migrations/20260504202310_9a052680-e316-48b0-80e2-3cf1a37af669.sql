-- Corretores podem atualizar/excluir tarefas dos seus próprios leads,
-- mesmo quando a tarefa foi criada por outro usuário (ex.: automações).
CREATE POLICY "Corretores can update tasks on their leads"
ON public.pipeline_tarefas
FOR UPDATE
USING (
  pipeline_lead_id IN (
    SELECT id FROM public.pipeline_leads WHERE corretor_id = auth.uid()
  )
);

CREATE POLICY "Corretores can delete tasks on their leads"
ON public.pipeline_tarefas
FOR DELETE
USING (
  pipeline_lead_id IN (
    SELECT id FROM public.pipeline_leads WHERE corretor_id = auth.uid()
  )
);