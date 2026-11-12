DROP POLICY IF EXISTS "passos legiveis" ON public.cadencia_sem_contato_passos;
CREATE POLICY "passos legiveis" ON public.cadencia_sem_contato_passos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.cadencia_sem_contato_passos FROM anon;

DROP POLICY IF EXISTS "Users can insert negocios" ON public.negocios;
CREATE POLICY "Users can insert negocios" ON public.negocios FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role) OR public.has_role(auth.uid(),'diretor'::public.app_role)
  OR auth_user_id = auth.uid()
  OR corretor_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  OR (pipeline_lead_id IS NOT NULL AND public.can_access_lead(pipeline_lead_id))
);

DROP POLICY IF EXISTS visita_eventos_insert_authenticated ON public.visita_eventos;
CREATE POLICY visita_eventos_insert_authenticated ON public.visita_eventos FOR INSERT TO authenticated WITH CHECK (
  ator_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role)
  OR (pipeline_lead_id IS NOT NULL AND public.can_access_lead(pipeline_lead_id))
);

DROP POLICY IF EXISTS insert_voice_campaigns ON public.voice_campaigns;
CREATE POLICY insert_voice_campaigns ON public.voice_campaigns FOR INSERT TO authenticated WITH CHECK (
  criado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role)
);