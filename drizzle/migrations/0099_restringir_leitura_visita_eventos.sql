DROP POLICY IF EXISTS "visita_eventos_select_authenticated" ON public.visita_eventos;
CREATE POLICY "visita_eventos_select_authenticated" ON public.visita_eventos
FOR SELECT TO authenticated
USING (
  ator_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  OR (pipeline_lead_id IS NOT NULL AND public.can_access_lead(pipeline_lead_id))
);