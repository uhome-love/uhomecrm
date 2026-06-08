
-- 1. Rewrite is_gerente_or_above to use authoritative user_roles table
CREATE OR REPLACE FUNCTION public.is_gerente_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor');
$$;

-- 2. anuncio_materiais table DELETE: owner or admin/gestor
DROP POLICY IF EXISTS anuncio_materiais_delete ON public.anuncio_materiais;
CREATE POLICY anuncio_materiais_delete ON public.anuncio_materiais
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
);

-- 2b. anuncio-materiais storage bucket DELETE: owner or admin/gestor
DROP POLICY IF EXISTS anuncio_materiais_storage_delete ON storage.objects;
CREATE POLICY anuncio_materiais_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'anuncio-materiais'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  )
);

-- 3. homi-documents bucket SELECT: restrict to admin/gestor
DROP POLICY IF EXISTS "Authenticated users can read homi docs" ON storage.objects;
DROP POLICY IF EXISTS "autenticados podem ler documentos homi" ON storage.objects;
CREATE POLICY "Admin/gestor read homi-documents" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'homi-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  )
);

-- 4. pagadoria-docs bucket INSERT: restrict to admin/backoffice
DROP POLICY IF EXISTS "Auth users can upload pagadoria docs" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_pagadoria_docs" ON storage.objects;
CREATE POLICY "Admin/backoffice upload pagadoria-docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pagadoria-docs'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'backoffice')
  )
);

-- 5. profiles: stop exposing sensitive columns to all authenticated users.
-- Owner & staff access continues through SECURITY DEFINER RPCs
-- (get_my_profile_full, list_profiles_admin) which bypass column grants.
REVOKE SELECT (cpf, creci, telefone) ON public.profiles FROM authenticated;
REVOKE SELECT (cpf, creci, telefone) ON public.profiles FROM anon;
