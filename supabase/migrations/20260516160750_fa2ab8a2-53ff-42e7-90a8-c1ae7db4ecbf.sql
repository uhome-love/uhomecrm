
-- Fase 2a-lite: bloquear leitura dos campos sensíveis CPF e CRECI da tabela profiles
-- Mantém SELECT amplo nas demais colunas (não-PII) para não quebrar 99+ telas.
-- Leitura legítima continua via RPCs SECURITY DEFINER:
--   * get_my_profile_full() — usuário lê o próprio
--   * list_profiles_admin() — admin/gestor lê todos
REVOKE SELECT (cpf) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (creci) ON public.profiles FROM anon, authenticated;
