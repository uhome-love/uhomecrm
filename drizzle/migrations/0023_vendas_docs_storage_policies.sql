CREATE OR REPLACE FUNCTION public.vendas_docs_pode(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role) THEN RETURN true; END IF;
  BEGIN v_id := split_part(p_name, '/', 1)::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.can_access_negocio(v_id);
END $$;
GRANT EXECUTE ON FUNCTION public.vendas_docs_pode(text) TO authenticated;

CREATE POLICY vendas_docs_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendas-docs' AND public.vendas_docs_pode(name));
CREATE POLICY vendas_docs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendas-docs' AND public.vendas_docs_pode(name));