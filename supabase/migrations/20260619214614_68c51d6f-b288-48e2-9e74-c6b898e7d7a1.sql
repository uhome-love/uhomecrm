CREATE POLICY admin_gestor_delete_intermediacoes
ON public.intermediacoes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY admin_gestor_delete_storage_intermediacoes
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'intermediacoes'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
);