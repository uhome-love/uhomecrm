CREATE OR REPLACE FUNCTION public.get_corretores_intermediacao()
RETURNS TABLE (
  user_id uuid,
  nome text,
  cpf text,
  email text,
  creci text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.nome, p.cpf, p.email, p.creci
  FROM public.profiles p
  WHERE p.user_id IN (
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'corretor'
  )
  AND p.nome IS NOT NULL
  ORDER BY p.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_corretores_intermediacao() TO authenticated;