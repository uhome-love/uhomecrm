CREATE OR REPLACE FUNCTION public.roleta_corretor_sair(p_turno text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_id UUID;
  v_data DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Resolve profile do próprio corretor autenticado
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'perfil não encontrado' USING ERRCODE = '42501';
  END IF;

  IF p_turno NOT IN ('manha','tarde','noturna') THEN
    RAISE EXCEPTION 'turno inválido: %', p_turno;
  END IF;

  -- Upsert em roleta_presencas: status=saiu, saiu_em=now
  INSERT INTO public.roleta_presencas
    (corretor_id, data, turno, status, chegou_em, saiu_em, validado_por, validado_em)
  VALUES
    (v_profile_id, v_data, p_turno, 'saiu', NULL, v_now, v_profile_id, v_now)
  ON CONFLICT (corretor_id, data, turno) DO UPDATE
    SET status = 'saiu',
        saiu_em = COALESCE(public.roleta_presencas.saiu_em, EXCLUDED.saiu_em),
        chegou_em = COALESCE(public.roleta_presencas.chegou_em, NULL),
        validado_por = v_profile_id,
        validado_em = v_now,
        updated_at = v_now;

  -- Marca credenciamentos do dia como "saiu"
  UPDATE public.roleta_credenciamentos
     SET status = 'saiu', saiu_em = v_now
   WHERE corretor_id = v_profile_id
     AND data = v_data
     AND status IN ('pendente','aprovado');

  -- Desativa fila
  UPDATE public.roleta_fila
     SET ativo = false
   WHERE corretor_id = v_profile_id
     AND data = v_data
     AND ativo = true;

  -- Sincroniza disponibilidade
  UPDATE public.corretor_disponibilidade
     SET na_roleta = false, updated_at = v_now
   WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.roleta_corretor_sair(text) TO authenticated;