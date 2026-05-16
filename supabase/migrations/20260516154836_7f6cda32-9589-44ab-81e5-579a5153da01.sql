-- Lote D2: restringir coluna CPF e criar RPCs seguras

-- 1) Revogar acesso de leitura à coluna cpf para authenticated/anon
REVOKE SELECT (cpf) ON public.profiles FROM authenticated;
REVOKE SELECT (cpf) ON public.profiles FROM anon;

-- 2) RPC: perfil completo do próprio usuário
CREATE OR REPLACE FUNCTION public.get_my_profile_full()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nome text,
  email text,
  telefone text,
  cargo text,
  cpf text,
  creci text,
  avatar_url text,
  avatar_preview_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.nome, p.email, p.telefone, p.cargo,
         p.cpf, p.creci, p.avatar_url, p.avatar_preview_url
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile_full() TO authenticated;

-- 3) RPC: listagem completa para admin/gestor
CREATE OR REPLACE FUNCTION public.list_profiles_admin()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  cpf text,
  creci text,
  cargo text,
  telefone text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.email, p.cpf, p.creci, p.cargo, p.telefone, p.avatar_url
  FROM public.profiles p
  WHERE (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  )
  AND p.cargo IN ('corretor','gerente','admin')
  ORDER BY p.cargo, p.nome;
$$;

GRANT EXECUTE ON FUNCTION public.list_profiles_admin() TO authenticated;