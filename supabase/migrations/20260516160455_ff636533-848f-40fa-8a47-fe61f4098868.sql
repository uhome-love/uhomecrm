
DROP FUNCTION public.list_profiles_admin();

CREATE FUNCTION public.list_profiles_admin()
RETURNS TABLE(
  id uuid, nome text, email text, cpf text, creci text, cargo text,
  telefone text, avatar_url text,
  equipe text, gerente_nome text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.nome, p.email, p.cpf, p.creci, p.cargo, p.telefone, p.avatar_url,
    tm.equipe,
    gp.nome AS gerente_nome
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT t.equipe, t.gerente_id
    FROM public.team_members t
    WHERE t.user_id = p.user_id AND t.status = 'ativo'
    ORDER BY t.updated_at DESC
    LIMIT 1
  ) tm ON true
  LEFT JOIN public.profiles gp ON gp.user_id = tm.gerente_id
  WHERE (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  )
  AND p.cargo IN ('corretor','gerente','admin')
  ORDER BY p.cargo, p.nome;
$function$;
