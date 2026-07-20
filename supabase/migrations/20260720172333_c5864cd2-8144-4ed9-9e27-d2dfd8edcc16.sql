
-- 1. Delete ghost users: hugo teste + TIAGO MOLITOR
DELETE FROM public.user_roles WHERE user_id IN ('ea16e0d3-641f-4b40-92a5-3cfa3748878a','4f208e0e-fb9b-4109-8793-75e9e5917d7f');
DELETE FROM public.profiles WHERE id IN ('3cf71c62-4050-4298-9434-fe49c408ca9f','4bdc9be8-1c07-4ef7-a9c6-1280212570ec');

-- 2. Extend roleta_marcar_presenca to accept manual timestamps
CREATE OR REPLACE FUNCTION public.roleta_marcar_presenca(
  p_corretor_id uuid,
  p_data date,
  p_turnos text[],
  p_status text,
  p_observacao text DEFAULT NULL::text,
  p_chegou_em timestamptz DEFAULT NULL,
  p_saiu_em timestamptz DEFAULT NULL
)
 RETURNS SETOF roleta_presencas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id UUID;
  v_validador_profile UUID;
  v_turnos_norm TEXT[];
  v_turno TEXT;
  v_now TIMESTAMPTZ := now();
  v_chegou TIMESTAMPTZ;
  v_saiu TIMESTAMPTZ;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('na_empresa','saiu','falta') THEN
    RAISE EXCEPTION 'status inválido: %', p_status;
  END IF;

  -- Validação de horários manuais (não pode ser futuro; deve ser do dia p_data em BRT)
  IF p_chegou_em IS NOT NULL THEN
    IF p_chegou_em > v_now + interval '1 minute' THEN
      RAISE EXCEPTION 'horário de chegada não pode ser futuro';
    END IF;
    IF (p_chegou_em AT TIME ZONE 'America/Sao_Paulo')::date <> p_data THEN
      RAISE EXCEPTION 'horário de chegada fora do dia %', p_data;
    END IF;
  END IF;
  IF p_saiu_em IS NOT NULL THEN
    IF p_saiu_em > v_now + interval '1 minute' THEN
      RAISE EXCEPTION 'horário de saída não pode ser futuro';
    END IF;
    IF (p_saiu_em AT TIME ZONE 'America/Sao_Paulo')::date <> p_data THEN
      RAISE EXCEPTION 'horário de saída fora do dia %', p_data;
    END IF;
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE id = p_corretor_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = p_corretor_id LIMIT 1;
  END IF;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'corretor não encontrado: %', p_corretor_id;
  END IF;

  SELECT id INTO v_validador_profile FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  v_turnos_norm := public.roleta_expand_turnos(p_turnos);

  v_chegou := CASE WHEN p_status = 'na_empresa' THEN COALESCE(p_chegou_em, v_now) ELSE NULL END;
  v_saiu   := CASE WHEN p_status = 'saiu' THEN COALESCE(p_saiu_em, v_now) ELSE NULL END;

  FOREACH v_turno IN ARRAY v_turnos_norm LOOP
    INSERT INTO public.roleta_presencas(
      corretor_id, data, turno, status, chegou_em, saiu_em, validado_por, validado_em, observacao
    ) VALUES (
      v_profile_id, p_data, v_turno, p_status,
      v_chegou, v_saiu,
      v_validador_profile, v_now, p_observacao
    )
    ON CONFLICT (corretor_id, data, turno) DO UPDATE SET
      status = EXCLUDED.status,
      chegou_em = CASE
        WHEN EXCLUDED.status = 'na_empresa' THEN COALESCE(p_chegou_em, public.roleta_presencas.chegou_em, v_now)
        ELSE public.roleta_presencas.chegou_em
      END,
      saiu_em = CASE
        WHEN EXCLUDED.status = 'saiu' THEN COALESCE(p_saiu_em, v_now)
        WHEN EXCLUDED.status = 'na_empresa' THEN NULL
        ELSE public.roleta_presencas.saiu_em
      END,
      validado_por = v_validador_profile,
      validado_em = v_now,
      observacao = COALESCE(EXCLUDED.observacao, public.roleta_presencas.observacao);

    IF p_status = 'saiu' THEN
      UPDATE public.roleta_fila
         SET ativo = false
       WHERE corretor_id = v_profile_id
         AND data = p_data
         AND janela = v_turno
         AND ativo = true;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT * FROM public.roleta_presencas
     WHERE corretor_id = v_profile_id AND data = p_data AND turno = ANY(v_turnos_norm);
END;
$function$;
