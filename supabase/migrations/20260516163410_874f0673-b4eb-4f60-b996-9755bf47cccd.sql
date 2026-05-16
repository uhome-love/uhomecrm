
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id, user_id, nome, cargo,
  avatar_url, avatar_gamificado_url, avatar_preview_url, avatar_updated_at,
  status_online, status_updated_at, de_plantao, ativo, slug_ref,
  created_at, updated_at
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_team_contacts(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  nome text,
  email text,
  telefone text,
  avatar_url text,
  avatar_gamificado_url text,
  cargo text,
  status_online text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nome, p.email, p.telefone, p.avatar_url, p.avatar_gamificado_url, p.cargo, p.status_online
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
      OR p.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_team_contacts(uuid[]) TO authenticated;
