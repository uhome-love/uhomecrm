
-- 1. melnick_campaign_analytics: restrict INSERT to admin/gestor (service role bypasses RLS)
DROP POLICY IF EXISTS "Service role can insert analytics" ON public.melnick_campaign_analytics;
CREATE POLICY "Admins and gestores can insert analytics"
  ON public.melnick_campaign_analytics FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- 2. tarefas: replace profiles.cargo check with authoritative has_role()
DROP POLICY IF EXISTS "users_manage_own_tarefas" ON public.tarefas;
CREATE POLICY "users_manage_own_tarefas"
  ON public.tarefas FOR ALL TO authenticated
  USING (
    (criado_por IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
    OR (responsavel_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
  )
  WITH CHECK (
    (criado_por IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
    OR (responsavel_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'backoffice'::app_role)
  );

-- 3. voice_campaigns: restrict SELECT to admin/gestor or owner
DROP POLICY IF EXISTS "read_voice_campaigns" ON public.voice_campaigns;
CREATE POLICY "read_voice_campaigns"
  ON public.voice_campaigns FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR criado_por = auth.uid()
  );

-- 4. storage homi-documents: remove open/cargo-based INSERT, restrict to admin/gestor
DROP POLICY IF EXISTS "Authenticated users can upload homi docs" ON storage.objects;
DROP POLICY IF EXISTS "gerentes podem upload documentos homi" ON storage.objects;
CREATE POLICY "Admin/gestor upload homi-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homi-documents'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );
