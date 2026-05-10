-- Corrige credenciamento manual incorreto: Douglas Costa foi incluído manualmente
-- na janela "tarde" (forçada pelo modal) quando a intenção era "noturna".
-- Move o credenciamento de hoje para a janela noturna e insere na fila noturna.

DO $$
DECLARE
  v_cred_id uuid;
  v_seg_id uuid;
  v_corretor_id uuid := 'ae0517f6-628a-4596-873c-3f44d9b15a22';
  v_data date := CURRENT_DATE;
BEGIN
  SELECT id, segmento_1_id INTO v_cred_id, v_seg_id
  FROM public.roleta_credenciamentos
  WHERE corretor_id = v_corretor_id
    AND data = v_data
    AND janela = 'tarde'
    AND status = 'aprovado'
  LIMIT 1;

  IF v_cred_id IS NOT NULL THEN
    UPDATE public.roleta_credenciamentos
    SET janela = 'noturna'
    WHERE id = v_cred_id;

    -- Remove qualquer linha antiga na fila para esta janela/data
    DELETE FROM public.roleta_fila
    WHERE corretor_id = v_corretor_id
      AND data = v_data
      AND janela IN ('tarde', 'noturna');

    -- Insere na fila noturna via RPC
    PERFORM public.upsert_roleta_fila(
      p_corretor_id := v_corretor_id,
      p_segmento_id := v_seg_id,
      p_janela := 'noturna',
      p_data := v_data,
      p_credenciamento_id := v_cred_id
    );
  END IF;
END $$;