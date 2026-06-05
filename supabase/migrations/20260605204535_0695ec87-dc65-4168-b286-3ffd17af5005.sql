-- Security hardening: scope overly-permissive RLS policies flagged by scanner (2026-06-05)

DROP POLICY IF EXISTS "Users can insert lead_progressao" ON public.lead_progressao;
CREATE POLICY "Users can insert lead_progressao"
ON public.lead_progressao
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (lead_id IS NOT NULL AND can_access_lead(lead_id))
  OR auth_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can view lead_progressao" ON public.lead_progressao;
CREATE POLICY "Users can view lead_progressao"
ON public.lead_progressao
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (lead_id IS NOT NULL AND can_access_lead(lead_id))
  OR auth_user_id = auth.uid()
);

DROP POLICY IF EXISTS "gestors_select_all" ON public.melnick_metas_diarias;
CREATE POLICY "gestors_select_own"
ON public.melnick_metas_diarias
FOR SELECT TO authenticated
USING (
  gerente_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can update negocios" ON public.negocios;
CREATE POLICY "Users can update negocios"
ON public.negocios
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR can_access_negocio(id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR can_access_negocio(id)
);

DROP POLICY IF EXISTS "auth_read" ON public.perfil_interesse;
CREATE POLICY "auth_read"
ON public.perfil_interesse
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (pipeline_lead_id IS NOT NULL AND can_access_lead(pipeline_lead_id))
  OR (lead_id IS NOT NULL AND can_access_lead(lead_id))
);

DROP POLICY IF EXISTS "Users can insert pos_vendas" ON public.pos_vendas;
CREATE POLICY "Users can insert pos_vendas"
ON public.pos_vendas
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (negocio_id IS NOT NULL AND can_access_negocio(negocio_id))
  OR (lead_id IS NOT NULL AND can_access_lead(lead_id))
);

DROP POLICY IF EXISTS "auth read runs" ON public.reengajamento_dispatch_runs;
CREATE POLICY "admin gestor read runs"
ON public.reengajamento_dispatch_runs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

DROP POLICY IF EXISTS "auth read eventos" ON public.reengajamento_eventos;
CREATE POLICY "admin gestor read eventos"
ON public.reengajamento_eventos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

DROP POLICY IF EXISTS "sala_reservas_update" ON public.sala_reuniao_reservas;
CREATE POLICY "sala_reservas_update"
ON public.sala_reuniao_reservas
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "sala_reservas_delete" ON public.sala_reuniao_reservas;
CREATE POLICY "sala_reservas_delete"
ON public.sala_reuniao_reservas
FOR DELETE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "sala_reservas_insert" ON public.sala_reuniao_reservas;
CREATE POLICY "sala_reservas_insert"
ON public.sala_reuniao_reservas
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Public can view vitrines by id" ON public.vitrines;

DROP POLICY IF EXISTS "Authenticated can read vitrine interactions" ON public.vitrine_interacoes;
CREATE POLICY "Owners can read vitrine interactions"
ON public.vitrine_interacoes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR vitrine_id IN (
    SELECT id FROM public.vitrines WHERE created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow service role upload on whatsapp-media" ON storage.objects;
CREATE POLICY "Allow service role upload on whatsapp-media"
ON storage.objects
FOR INSERT TO service_role
WITH CHECK (bucket_id = 'whatsapp-media');