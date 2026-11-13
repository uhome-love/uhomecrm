DO $mig$
DECLARE d text; marker text := E'RETURN jsonb_build_object(''success'', false, ''error'', ''Lead não encontrado'');\n  END IF;';
BEGIN
  SELECT pg_get_functiondef('public.reativar_lead_para_fila_ceo(uuid,text)'::regprocedure) INTO d;
  IF position(marker in d) = 0 THEN RAISE EXCEPTION 'marker not found'; END IF;
  d := replace(d, marker, marker || E'\n\n  -- Lead ativo com corretor: fica com o dono, nada muda (nunca vai para a Fila do CEO).\n  IF v_lead.arquivado IS NOT TRUE\n     AND v_lead.stage_id IS DISTINCT FROM ''1dd66c25-3848-4053-9f66-82e902989b4d''::uuid\n     AND v_lead.motivo_descarte IS NULL\n     AND v_lead.corretor_id IS NOT NULL THEN\n    UPDATE public.pipeline_leads SET reengajamento_status = ''respondeu_sim'' WHERE id = p_lead_id;\n    RETURN jsonb_build_object(''success'', true, ''already_active'', true, ''corretor_id'', v_lead.corretor_id, ''pipeline_lead_id'', p_lead_id);\n  END IF;');
  EXECUTE d;
END $mig$;