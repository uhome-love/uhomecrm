-- RPC that handles the full credenciamento flow with auto-approval
CREATE OR REPLACE FUNCTION public.credenciar_na_roleta(
  p_corretor_id UUID,
  p_auth_user_id UUID,
  p_janela TEXT,
  p_segmento_1_id UUID,
  p_segmento_2_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pode BOOLEAN;
  v_cred_id UUID;
  v_hoje DATE := CURRENT_DATE;
  v_max_pos INTEGER;
BEGIN
  -- 1. Verify the auth user owns this profile
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_corretor_id AND user_id = p_auth_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Profile não pertence ao usuário');
  END IF;

  -- 2. Check eligibility
  v_pode := corretor_pode_entrar_roleta(p_auth_user_id);
  IF NOT v_pode THEN
    RETURN json_build_object('success', false, 'error', 'Você possui mais de 10 leads desatualizados. Atualize seu pipeline antes de entrar na roleta.');
  END IF;

  -- 3. Upsert credenciamento with auto-approve
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

  -- 4. Get max position for today/janela
  SELECT COALESCE(MAX(posicao), 0) INTO v_max_pos
  FROM roleta_fila WHERE data = v_hoje AND janela = p_janela AND ativo = true;

  -- 5. Insert into roleta_fila for segmento_1
  INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
  VALUES (v_cred_id, p_corretor_id, p_segmento_1_id, v_hoje, p_janela, v_max_pos + 1, true)
  ON CONFLICT DO NOTHING;

  -- 6. Insert into roleta_fila for segmento_2 (if provided)
  IF p_segmento_2_id IS NOT NULL THEN
    INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
    VALUES (v_cred_id, p_corretor_id, p_segmento_2_id, v_hoje, p_janela, v_max_pos + 2, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 7. Update corretor_disponibilidade
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
$$;

-- Fix existing pending credenciamentos from today so they work immediately
UPDATE roleta_credenciamentos
SET status = 'aprovado'
WHERE data = CURRENT_DATE AND status = 'pendente';
