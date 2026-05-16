CREATE OR REPLACE FUNCTION public.admin_delete_profile(_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: somente admin pode apagar cadastros';
  END IF;

  DELETE FROM public.profiles WHERE id = _profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_profile(uuid) TO authenticated;