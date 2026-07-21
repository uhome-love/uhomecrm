-- Restaurar GRANT SELECT completo em public.profiles para authenticated e service_role.
-- Diagnóstico: colunas email, telefone, cpf, creci, jetimob_user_id, ativo (entre outras)
-- não tinham SELECT granted a authenticated, quebrando SELECTs completos.
-- A RLS existente já restringe a "true" (authenticated pode ver todos), mas os grants
-- de coluna faltantes impediam o SELECT no PostgREST.

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;
GRANT ALL ON public.profiles TO service_role;