
DROP POLICY IF EXISTS "Admins and gestors can view campaign clicks" ON public.campaign_clicks;
DROP POLICY IF EXISTS "Admin/gestor read campaign_clicks" ON public.campaign_clicks;
CREATE POLICY "Admin/gestor read campaign_clicks"
ON public.campaign_clicks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Admins and managers can manage campaign map" ON public.jetimob_campaign_map;
DROP POLICY IF EXISTS "Admin/gestor manage campaign_map" ON public.jetimob_campaign_map;
CREATE POLICY "Admin/gestor manage campaign_map"
ON public.jetimob_campaign_map FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Admin gerencia trilhas" ON public.academia_trilhas;
