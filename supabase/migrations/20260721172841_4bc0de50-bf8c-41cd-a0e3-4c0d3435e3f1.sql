-- Reverter GRANT SELECT excessivo em public.profiles.
-- A memória de segurança determina: cpf, creci, telefone, email só via RPC SECURITY DEFINER
-- (get_my_profile_full, list_profiles_admin). Volta à postura anterior.

REVOKE SELECT ON public.profiles FROM authenticated;

-- Reconceder apenas colunas não-sensíveis que o app usa amplamente para
-- exibir nomes/avatares/status (padrão pré-existente).
GRANT SELECT (
  id, user_id, nome, cargo, avatar_url, avatar_gamificado_url, avatar_preview_url,
  avatar_updated_at, ativo, de_plantao, status_online, status_updated_at,
  slug_ref, created_at, updated_at
) ON public.profiles TO authenticated;

-- service_role mantém acesso pleno para edge functions/admin.
GRANT ALL ON public.profiles TO service_role;