
CREATE OR REPLACE FUNCTION public.list_profiles_admin_with_jetimob()
RETURNS TABLE (
  user_id uuid,
  nome text,
  email text,
  jetimob_user_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nome, p.email, p.jetimob_user_id
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.list_profiles_admin_with_jetimob() TO authenticated;
