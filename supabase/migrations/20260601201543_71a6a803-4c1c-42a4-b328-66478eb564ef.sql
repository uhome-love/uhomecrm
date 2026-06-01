
-- Helper: can current user access a pipeline lead
CREATE OR REPLACE FUNCTION public.can_access_lead(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_leads pl
    WHERE pl.id = p_lead_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR pl.corretor_id = auth.uid()
        OR (pl.corretor_id IS NOT NULL AND is_lead_in_my_team(pl.corretor_id))
        OR is_my_partner_lead(pl.id)
      )
  )
$$;

-- Helper: can current user access a negocio (deal)
CREATE OR REPLACE FUNCTION public.can_access_negocio(p_negocio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.negocios n
    WHERE n.id = p_negocio_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR n.auth_user_id = auth.uid()
        OR n.gerente_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR n.corretor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR n.corretor_id IN (
          SELECT p.id FROM public.profiles p
          JOIN public.team_members tm ON tm.user_id = p.user_id
          WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
        )
      )
  )
$$;

-- ai_call_sessions
DROP POLICY IF EXISTS "Authenticated users can manage sessions" ON public.ai_call_sessions;
CREATE POLICY "Owner or staff can manage ai_call_sessions"
ON public.ai_call_sessions FOR ALL TO authenticated
USING (created_by = auth.uid()::text OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
WITH CHECK (created_by = auth.uid()::text OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));

-- lead_nurturing_state
DROP POLICY IF EXISTS "Authenticated users can read lead_nurturing_state" ON public.lead_nurturing_state;
CREATE POLICY "Lead owners can read lead_nurturing_state"
ON public.lead_nurturing_state FOR SELECT TO authenticated
USING (pipeline_lead_id IS NOT NULL AND can_access_lead(pipeline_lead_id));

-- imoveis_interesse
DROP POLICY IF EXISTS "auth_read" ON public.imoveis_interesse;
CREATE POLICY "Lead owners can read imoveis_interesse"
ON public.imoveis_interesse FOR SELECT TO authenticated
USING (pipeline_lead_id IS NOT NULL AND can_access_lead(pipeline_lead_id));

-- lead_property_profiles
DROP POLICY IF EXISTS "Authenticated users can manage lead property profiles" ON public.lead_property_profiles;
CREATE POLICY "Lead owners can manage lead_property_profiles"
ON public.lead_property_profiles FOR ALL TO authenticated
USING (lead_id IS NOT NULL AND can_access_lead(lead_id))
WITH CHECK (lead_id IS NOT NULL AND can_access_lead(lead_id));

-- lead_property_matches
DROP POLICY IF EXISTS "Authenticated users can manage lead property matches" ON public.lead_property_matches;
CREATE POLICY "Lead owners can manage lead_property_matches"
ON public.lead_property_matches FOR ALL TO authenticated
USING (lead_id IS NOT NULL AND can_access_lead(lead_id))
WITH CHECK (lead_id IS NOT NULL AND can_access_lead(lead_id));

-- lead_property_interactions
DROP POLICY IF EXISTS "Authenticated users can manage lead property interactions" ON public.lead_property_interactions;
CREATE POLICY "Lead owners can manage lead_property_interactions"
ON public.lead_property_interactions FOR ALL TO authenticated
USING (lead_id IS NOT NULL AND can_access_lead(lead_id))
WITH CHECK (lead_id IS NOT NULL AND can_access_lead(lead_id));

-- lead_property_searches
DROP POLICY IF EXISTS "Authenticated users can manage lead searches" ON public.lead_property_searches;
CREATE POLICY "Lead owners can manage lead_property_searches"
ON public.lead_property_searches FOR ALL TO authenticated
USING (lead_id IS NOT NULL AND can_access_lead(lead_id))
WITH CHECK (lead_id IS NOT NULL AND can_access_lead(lead_id));

-- negocios_tarefas
DROP POLICY IF EXISTS "Authenticated users can read negocios_tarefas" ON public.negocios_tarefas;
DROP POLICY IF EXISTS "Authenticated users can insert negocios_tarefas" ON public.negocios_tarefas;
DROP POLICY IF EXISTS "Authenticated users can update negocios_tarefas" ON public.negocios_tarefas;
CREATE POLICY "Deal members can read negocios_tarefas"
ON public.negocios_tarefas FOR SELECT TO authenticated
USING (negocio_id IS NOT NULL AND can_access_negocio(negocio_id));
CREATE POLICY "Deal members can insert negocios_tarefas"
ON public.negocios_tarefas FOR INSERT TO authenticated
WITH CHECK (negocio_id IS NOT NULL AND can_access_negocio(negocio_id));
CREATE POLICY "Deal members can update negocios_tarefas"
ON public.negocios_tarefas FOR UPDATE TO authenticated
USING (negocio_id IS NOT NULL AND can_access_negocio(negocio_id))
WITH CHECK (negocio_id IS NOT NULL AND can_access_negocio(negocio_id));

-- negocios_atividades
DROP POLICY IF EXISTS "Authenticated users can read negocios_atividades" ON public.negocios_atividades;
DROP POLICY IF EXISTS "Authenticated users can insert negocios_atividades" ON public.negocios_atividades;
CREATE POLICY "Deal members can read negocios_atividades"
ON public.negocios_atividades FOR SELECT TO authenticated
USING (negocio_id IS NOT NULL AND can_access_negocio(negocio_id));
CREATE POLICY "Deal members can insert negocios_atividades"
ON public.negocios_atividades FOR INSERT TO authenticated
WITH CHECK (negocio_id IS NOT NULL AND can_access_negocio(negocio_id));

-- oportunidades
DROP POLICY IF EXISTS "auth_read" ON public.oportunidades;
CREATE POLICY "Lead owners can read oportunidades"
ON public.oportunidades FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR responsavel_id = auth.uid()
  OR (pipeline_lead_id IS NOT NULL AND can_access_lead(pipeline_lead_id))
  OR (lead_id IS NOT NULL AND can_access_lead(lead_id))
);

-- pos_vendas
DROP POLICY IF EXISTS "Users can view pos_vendas" ON public.pos_vendas;
CREATE POLICY "Deal members can view pos_vendas"
ON public.pos_vendas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (negocio_id IS NOT NULL AND can_access_negocio(negocio_id))
  OR (lead_id IS NOT NULL AND can_access_lead(lead_id))
);

-- roleta_desbloqueios
DROP POLICY IF EXISTS "Authenticated users can delete unblocks" ON public.roleta_desbloqueios;
DROP POLICY IF EXISTS "Authenticated users can insert unblocks" ON public.roleta_desbloqueios;
CREATE POLICY "Staff can delete unblocks"
ON public.roleta_desbloqueios FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));
CREATE POLICY "Staff can insert unblocks"
ON public.roleta_desbloqueios FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));

-- Materialized view exposed via Data API
REVOKE ALL ON public.page_views_daily FROM anon, authenticated;
