CREATE OR REPLACE FUNCTION public.admin_update_profile(
  _profile_id uuid,
  _nome text DEFAULT NULL,
  _email text DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _creci text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente admin ou gestor podem editar cadastros';
  END IF;

  UPDATE public.profiles
  SET
    nome     = COALESCE(NULLIF(_nome, ''), nome),
    email    = COALESCE(NULLIF(_email, ''), email),
    telefone = COALESCE(NULLIF(_telefone, ''), telefone),
    cpf      = COALESCE(NULLIF(_cpf, ''), cpf),
    creci    = COALESCE(NULLIF(_creci, ''), creci)
  WHERE id = _profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, text) TO authenticated;