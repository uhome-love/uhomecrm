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
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_auth_user_id;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile não encontrado');
  END IF;

  v_pode := corretor_pode_entrar_roleta(v_auth_user_id);
  IF NOT v_pode THEN
    RETURN json_build_object('success', false, 'error',
      'Você possui mais de 10 leads desatualizados. Atualize seu pipeline antes de entrar na roleta.');
  END IF;

  SELECT empreendimentos INTO v_alocacao
  FROM corretor_alocacao WHERE user_id = v_auth_user_id;

  IF v_alocacao IS NULL OR array_length(v_alocacao, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Você ainda não tem empreendimentos alocados. Fale com seu gestor.');
  END IF;

  SELECT array_agg(DISTINCT ec.segmento_id ORDER BY ec.segmento_id)
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

  -- Insere/atualiza como PENDENTE — aguarda aprovação manual do CEO.
  -- Não insere em roleta_fila nem em corretor_disponibilidade aqui:
  -- aprovarCredenciamento cuida disso após aprovação.
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