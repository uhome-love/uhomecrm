
-- Fix: allow corretors to see all activities on their leads (not just own-created)
DROP POLICY IF EXISTS "Corretores can view own atividades" ON public.pipeline_atividades;

CREATE POLICY "Corretores can view own atividades" ON public.pipeline_atividades
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.pipeline_leads pl
    WHERE pl.id = pipeline_atividades.pipeline_lead_id
    AND pl.corretor_id = auth.uid()
  )
);
