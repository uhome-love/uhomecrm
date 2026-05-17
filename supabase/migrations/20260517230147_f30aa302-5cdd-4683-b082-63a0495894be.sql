
-- ============================================================
-- Security hardening migration: RLS fixes for high-risk tables
-- ============================================================

-- ---- 1) profiles: prevent cargo self-escalation ----
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND cargo IS NOT DISTINCT FROM (SELECT p.cargo FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- ---- 2) empreendimento_overrides: restrict writes to admin/gestor ----
DROP POLICY IF EXISTS "Authenticated can insert overrides" ON public.empreendimento_overrides;
DROP POLICY IF EXISTS "Authenticated can update overrides" ON public.empreendimento_overrides;
DROP POLICY IF EXISTS "Authenticated can delete overrides" ON public.empreendimento_overrides;
CREATE POLICY "Managers can insert overrides"
  ON public.empreendimento_overrides FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Managers can update overrides"
  ON public.empreendimento_overrides FOR UPDATE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Managers can delete overrides"
  ON public.empreendimento_overrides FOR DELETE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

-- ---- 3) marketplace_scripts: owner-only update ----
DROP POLICY IF EXISTS "marketplace_scripts_update" ON public.marketplace_scripts;
CREATE POLICY "marketplace_scripts_update"
  ON public.marketplace_scripts FOR UPDATE
  USING (
    autor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  );

-- ---- 4) pipeline_playbooks + pipeline_playbook_tarefas: restrict writes ----
DROP POLICY IF EXISTS "Authenticated users can manage playbooks" ON public.pipeline_playbooks;
CREATE POLICY "Managers manage playbooks"
  ON public.pipeline_playbooks FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Authenticated users can manage playbook tasks" ON public.pipeline_playbook_tarefas;
CREATE POLICY "Managers manage playbook tasks"
  ON public.pipeline_playbook_tarefas FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

-- ---- 5) rh_conversas: restrict to admin/rh ----
DROP POLICY IF EXISTS "rh_conversas_select" ON public.rh_conversas;
DROP POLICY IF EXISTS "rh_conversas_insert" ON public.rh_conversas;
DROP POLICY IF EXISTS "rh_conversas_update" ON public.rh_conversas;
CREATE POLICY "rh_conversas_select"
  ON public.rh_conversas FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "rh_conversas_insert"
  ON public.rh_conversas FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "rh_conversas_update"
  ON public.rh_conversas FOR UPDATE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));

-- ---- 6) rh_entrevistas: restrict to admin/rh ----
DROP POLICY IF EXISTS "Authenticated users can manage interviews" ON public.rh_entrevistas;
CREATE POLICY "RH manage interviews"
  ON public.rh_entrevistas FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
