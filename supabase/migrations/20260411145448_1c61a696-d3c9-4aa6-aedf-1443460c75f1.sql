
CREATE OR REPLACE FUNCTION public.upsert_roleta_fila(
  p_corretor_id uuid,
  p_segmento_id uuid,
  p_data date,
  p_janela text,
  p_credenciamento_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_next_pos integer;
BEGIN
  -- Check if already exists
  SELECT id INTO v_existing_id
  FROM roleta_fila
  WHERE corretor_id = p_corretor_id
    AND segmento_id = p_segmento_id
    AND data = p_data
    AND janela = p_janela
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Reactivate
    UPDATE roleta_fila
    SET ativo = true,
        credenciamento_id = COALESCE(p_credenciamento_id, credenciamento_id)
    WHERE id = v_existing_id;
  ELSE
    -- Get next position
    SELECT COALESCE(MAX(posicao), 0) + 1 INTO v_next_pos
    FROM roleta_fila
    WHERE data = p_data
      AND janela = p_janela
      AND segmento_id = p_segmento_id;

    INSERT INTO roleta_fila (corretor_id, segmento_id, data, janela, posicao, credenciamento_id, ativo)
    VALUES (p_corretor_id, p_segmento_id, p_data, p_janela, v_next_pos, p_credenciamento_id, true);
  END IF;

  -- ── Ensure corretor is eligible in distribution engine ──
  -- Resolve auth user_id from profiles and upsert corretor_disponibilidade
  INSERT INTO corretor_disponibilidade (user_id, na_roleta, status, segmentos)
  SELECT p2.user_id, true, 'na_empresa', '{}'::text[]
  FROM profiles p2
  WHERE p2.id = p_corretor_id AND p2.user_id IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE
  SET na_roleta = true, updated_at = now();
END;
$$;
