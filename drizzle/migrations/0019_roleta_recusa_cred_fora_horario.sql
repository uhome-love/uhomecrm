CREATE OR REPLACE FUNCTION public.roleta_janela_cred_faixa(p_janela text, OUT ini int, OUT fim int, OUT nome text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT x.ini, x.fim, x.nome FROM (VALUES
    ('manha', 420, 570, 'da manhã'),
    ('tarde', 720, 810, 'da tarde'),
    ('noturna', 1080, 1290, 'da noite'),
    ('dia_todo', 480, 1410, 'do dia')) x(j, ini, fim, nome)
  WHERE x.j = p_janela
$$;

CREATE OR REPLACE FUNCTION public.roleta_janela_cred_aberta(p_janela text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE v_now timestamp := now() AT TIME ZONE 'America/Sao_Paulo'; v_min int; v_ini int; v_fim int;
BEGIN
  SELECT ini, fim INTO v_ini, v_fim FROM public.roleta_janela_cred_faixa(p_janela);
  IF v_ini IS NULL THEN RETURN true; END IF;
  v_min := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
  RETURN v_min >= v_ini AND v_min < v_fim;
END $$;

CREATE OR REPLACE FUNCTION public.roleta_janela_cred_msg(p_janela text)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT format('Credenciamento %s fechado. Abre às %s e fecha às %s.', nome,
    lpad((ini/60)::text,2,'0')||':'||lpad((ini%60)::text,2,'0'),
    lpad((fim/60)::text,2,'0')||':'||lpad((fim%60)::text,2,'0'))
  FROM public.roleta_janela_cred_faixa(p_janela)
$$;

GRANT EXECUTE ON FUNCTION public.roleta_janela_cred_faixa(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roleta_janela_cred_aberta(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roleta_janela_cred_msg(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.credenciar_na_roleta(p_corretor_id uuid, p_auth_user_id uuid, p_janela text, p_segmento_1_id uuid, p_segmento_2_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pode BOOLEAN;
  v_cred_id UUID;
  v_hoje DATE := CURRENT_DATE;
  v_max_pos INTEGER;
  v_motivo JSONB;
  v_nome TEXT;
  v_dest UUID;
BEGIN
  IF NOT public.roleta_janela_cred_aberta(p_janela) THEN
    RETURN json_build_object('success', false, 'error', public.roleta_janela_cred_msg(p_janela));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_corretor_id AND user_id = p_auth_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Profile não pertence ao usuário');
  END IF;

  v_pode := corretor_pode_entrar_roleta(p_auth_user_id, p_janela);
  IF NOT v_pode THEN
    v_motivo := public.roleta_motivo_bloqueio(p_auth_user_id, p_janela);
    SELECT nome INTO v_nome FROM profiles WHERE id = p_corretor_id;

    BEGIN
      FOR v_dest IN
        SELECT DISTINCT u FROM (
          SELECT tm.gerente_id AS u
          FROM team_members tm
          WHERE tm.user_id = p_auth_user_id AND tm.status = 'ativo'
          UNION
          SELECT ur.user_id FROM user_roles ur WHERE ur.role IN ('admin', 'diretor')
        ) d
        WHERE u IS NOT NULL
      LOOP
        PERFORM public.criar_notificacao(
          v_dest,
          'alerta',
          'roleta_bloqueio',
          format('%s bloqueado na roleta %s', COALESCE(v_nome, 'Corretor'), p_janela),
          format('%s: %s', v_motivo->>'titulo', v_motivo->>'texto'),
          jsonb_build_object(
            'corretor_id', p_corretor_id,
            'auth_user_id', p_auth_user_id,
            'janela', p_janela,
            'motivo', v_motivo
          ),
          'roleta_bloqueio:' || p_auth_user_id::text || ':' || p_janela || ':' || v_hoje::text
        );
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN json_build_object(
      'success', false,
      'error', format('%s — %s', v_motivo->>'titulo', v_motivo->>'texto'),
      'motivo', v_motivo
    );
  END IF;

  INSERT INTO roleta_credenciamentos (
    corretor_id, auth_user_id, data, janela,
    segmento_1_id, segmento_2_id, status
  ) VALUES (
    p_corretor_id, p_auth_user_id, v_hoje, p_janela,
    p_segmento_1_id, p_segmento_2_id, 'aprovado'
  )
  ON CONFLICT (corretor_id, data, janela)
  DO UPDATE SET
    segmento_1_id = EXCLUDED.segmento_1_id,
    segmento_2_id = EXCLUDED.segmento_2_id,
    status = 'aprovado',
    saiu_em = NULL
  RETURNING id INTO v_cred_id;

  SELECT COALESCE(MAX(posicao), 0) INTO v_max_pos
  FROM roleta_fila WHERE data = v_hoje AND janela = p_janela AND ativo = true;

  INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
  VALUES (v_cred_id, p_corretor_id, p_segmento_1_id, v_hoje, p_janela, v_max_pos + 1, true)
  ON CONFLICT DO NOTHING;

  IF p_segmento_2_id IS NOT NULL THEN
    INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
    VALUES (v_cred_id, p_corretor_id, p_segmento_2_id, v_hoje, p_janela, v_max_pos + 2, true)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE corretor_disponibilidade
  SET na_roleta = true, updated_at = NOW()
  WHERE user_id = p_auth_user_id;

  IF NOT FOUND THEN
    INSERT INTO corretor_disponibilidade (user_id, na_roleta, status, updated_at)
    VALUES (p_auth_user_id, true, 'online', NOW())
    ON CONFLICT (user_id) DO UPDATE SET na_roleta = true, updated_at = NOW();
  END IF;

  RETURN json_build_object(
    'success', true,
    'credenciamento_id', v_cred_id,
    'status', 'aprovado',
    'message', 'Credenciamento aprovado! Você está na roleta.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.credenciar_por_alocacao(p_janela text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_pode boolean;
  v_alocacao uuid[];
  v_segmentos uuid[];
  v_seg1 uuid;
  v_seg2 uuid;
  v_cred_id uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.roleta_janela_cred_aberta(p_janela) THEN
    RETURN json_build_object('success', false, 'error', public.roleta_janela_cred_msg(p_janela));
  END IF;
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_auth_user_id;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile não encontrado');
  END IF;

  v_pode := corretor_pode_entrar_roleta(v_auth_user_id, p_janela);
  IF NOT v_pode THEN
    RETURN json_build_object('success', false, 'error',
      COALESCE(public.roleta_motivo_bloqueio(v_auth_user_id, p_janela)->>'texto', 'Você está bloqueado para esta janela.'), 'motivo', public.roleta_motivo_bloqueio(v_auth_user_id, p_janela));
  END IF;

  SELECT empreendimentos INTO v_alocacao
  FROM corretor_alocacao WHERE user_id = v_auth_user_id;

  IF v_alocacao IS NULL OR array_length(v_alocacao, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Você ainda não tem empreendimentos alocados. Fale com seu gestor.');
  END IF;

  SELECT array_agg(DISTINCT ec.segmento_id)
    INTO v_segmentos
  FROM empreendimentos_canonicos ec
  WHERE ec.id = ANY(v_alocacao)
    AND ec.segmento_id IS NOT NULL;

  IF v_segmentos IS NULL OR array_length(v_segmentos, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Nenhum segmento identificado nos empreendimentos alocados. Fale com seu gestor.');
  END IF;

  v_seg1 := v_segmentos[1];
  IF array_length(v_segmentos, 1) >= 2 THEN v_seg2 := v_segmentos[2]; END IF;

  INSERT INTO roleta_credenciamentos (
    corretor_id, auth_user_id, data, janela,
    segmento_1_id, segmento_2_id, status
  ) VALUES (
    v_profile_id, v_auth_user_id, v_hoje, p_janela,
    v_seg1, v_seg2, 'pendente'
  )
  ON CONFLICT (corretor_id, data, janela)
  DO UPDATE SET
    segmento_1_id = EXCLUDED.segmento_1_id,
    segmento_2_id = EXCLUDED.segmento_2_id,
    status = CASE
      WHEN roleta_credenciamentos.status = 'aprovado' THEN 'aprovado'
      ELSE 'pendente'
    END,
    saiu_em = NULL
  RETURNING id INTO v_cred_id;

  RETURN json_build_object('success', true, 'credenciamento_id', v_cred_id,
    'message', 'Credenciamento enviado! Aguardando aprovação do CEO.');
END;
$function$;