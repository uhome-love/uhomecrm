CREATE OR REPLACE FUNCTION public.get_gerentes_recrutamento()
RETURNS TABLE (user_id uuid, nome text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nome, p.avatar_url
  FROM public.profiles p
  WHERE EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'gestor'::public.app_role
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = p.user_id AND ur2.role = 'diretor'::public.app_role
    )
    AND COALESCE(p.ativo, true) = true
  ORDER BY p.nome
$$;

REVOKE ALL ON FUNCTION public.get_gerentes_recrutamento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gerentes_recrutamento() TO authenticated;