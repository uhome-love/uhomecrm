
-- Fix: allow corretors to see all anotacoes on their leads
DROP POLICY IF EXISTS "Corretores can view own anotacoes" ON public.pipeline_anotacoes;
CREATE POLICY "Corretores can view own anotacoes" ON public.pipeline_anotacoes
FOR SELECT TO authenticated
USING (
  autor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.pipeline_leads pl
    WHERE pl.id = pipeline_anotacoes.pipeline_lead_id
    AND pl.corretor_id = auth.uid()
  )
);

-- Fix: allow corretors to see historico on their leads
DROP POLICY IF EXISTS "Authenticated can view pipeline historico" ON public.pipeline_historico;
CREATE POLICY "Authenticated can view pipeline historico" ON public.pipeline_historico
FOR SELECT TO authenticated
USING (
  movido_por = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.pipeline_leads pl
    WHERE pl.id = pipeline_historico.pipeline_lead_id
    AND pl.corretor_id = auth.uid()
  )
);
