-- Provide a secure, single-source way for corretores to read today's visitas marcadas
-- from checkpoint aggregation without exposing checkpoint tables via permissive RLS.
CREATE OR REPLACE FUNCTION public.get_corretor_daily_visitas(p_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_team_member_id uuid;
  v_gerente_id uuid;
  v_checkpoint_id uuid;
  v_visitas integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Prevent arbitrary reads by non-privileged users
  IF p_user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'gestor') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT tm.id, tm.gerente_id
  INTO v_team_member_id, v_gerente_id
  FROM public.team_members tm
  WHERE tm.user_id = p_user_id
    AND tm.status = 'ativo'
  LIMIT 1;

  IF v_team_member_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT c.id
  INTO v_checkpoint_id
  FROM public.checkpoints c
  WHERE c.gerente_id = v_gerente_id
    AND c.data = v_today
  LIMIT 1;

  IF v_checkpoint_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(cl.real_visitas_marcadas, 0)
  INTO v_visitas
  FROM public.checkpoint_lines cl
  WHERE cl.checkpoint_id = v_checkpoint_id
    AND cl.corretor_id = v_team_member_id
  LIMIT 1;

  RETURN COALESCE(v_visitas, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_corretor_daily_visitas(uuid) TO authenticated;