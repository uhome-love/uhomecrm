
CREATE POLICY "Corretores can view tasks on their leads"
ON public.pipeline_tarefas FOR SELECT TO authenticated
USING (
  pipeline_lead_id IN (
    SELECT id FROM public.pipeline_leads WHERE corretor_id = auth.uid()
  )
);
