-- Lote D1: Restrict SELECT on public.leads to admin/gestor only.
-- Edge functions use service_role and bypass RLS. Only DiagnosticoSite (admin page) reads it from the client.

DROP POLICY IF EXISTS "auth_read" ON public.leads;

CREATE POLICY "leads_select_admin_gestor"
ON public.leads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);