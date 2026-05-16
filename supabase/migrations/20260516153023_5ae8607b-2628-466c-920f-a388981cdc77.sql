
DROP POLICY IF EXISTS "Authenticated users can read brevo_contacts" ON public.brevo_contacts;
CREATE POLICY "Admin/backoffice read brevo_contacts"
ON public.brevo_contacts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'backoffice'));

DROP POLICY IF EXISTS "rh_candidatos_select" ON public.rh_candidatos;
DROP POLICY IF EXISTS "rh_candidatos_insert" ON public.rh_candidatos;
DROP POLICY IF EXISTS "rh_candidatos_update" ON public.rh_candidatos;
DROP POLICY IF EXISTS "rh_candidatos_delete" ON public.rh_candidatos;
CREATE POLICY "Admin/rh select rh_candidatos"
ON public.rh_candidatos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "Admin/rh insert rh_candidatos"
ON public.rh_candidatos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "Admin/rh update rh_candidatos"
ON public.rh_candidatos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));
CREATE POLICY "Admin/rh delete rh_candidatos"
ON public.rh_candidatos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rh'));

DROP POLICY IF EXISTS "Authenticated can view credores" ON public.pagadoria_credores;
CREATE POLICY "Admin/backoffice/gestor read credores"
ON public.pagadoria_credores FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'backoffice')
    OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Auth users can view pagadoria docs" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_pagadoria_docs" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_pagadoria_docs" ON storage.objects;
CREATE POLICY "Admin/backoffice read pagadoria-docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pagadoria-docs'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'backoffice'))
);
CREATE POLICY "Admin/backoffice delete pagadoria-docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pagadoria-docs'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'backoffice'))
);
