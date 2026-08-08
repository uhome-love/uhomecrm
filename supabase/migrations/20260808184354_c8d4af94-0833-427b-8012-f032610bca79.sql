CREATE OR REPLACE FUNCTION public.capi_guarda_selftest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lead_id   uuid;
  v_ret       text;
  v_ops_id    uuid;
  v_enfileirou boolean;
  v_status    text;
  v_inicio    timestamptz := clock_timestamp();
BEGIN
  SELECT id INTO v_lead_id
    FROM public.pipeline_leads
   WHERE (meta_lead_id IS NULL OR btrim(meta_lead_id) = '')
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.ops_events (fn, level, category, message, ctx)
    VALUES ('capi_guarda_selftest', 'info', 'capi_selftest',
            'capi_guarda_selftest: nao_aplicavel',
            jsonb_build_object('selftest', true, 'resultado', 'nao_aplicavel'));
    RETURN jsonb_build_object('resultado', 'nao_aplicavel');
  END IF;

  v_ret := public.enqueue_meta_capi_event(
    p_lead_id => v_lead_id,
    p_event_name => 'GuardaSelfTest'
  );

  -- Marca APENAS o bloqueio criado por esta execução (ainda não marcado).
  UPDATE public.ops_events
     SET ctx = COALESCE(ctx, '{}'::jsonb) || jsonb_build_object('selftest', true)
   WHERE id = (
     SELECT id FROM public.ops_events
      WHERE category = 'capi_bloqueado_sem_lead_id'
        AND ctx->>'event_name' = 'GuardaSelfTest'
        AND created_at >= v_inicio
        AND COALESCE(ctx->>'selftest', '') <> 'true'
      ORDER BY created_at DESC
      LIMIT 1
   )
  RETURNING id INTO v_ops_id;

  SELECT EXISTS (
    SELECT 1 FROM public.meta_capi_queue WHERE event_name = 'GuardaSelfTest'
  ) INTO v_enfileirou;

  DELETE FROM public.meta_capi_queue WHERE event_name = 'GuardaSelfTest';

  v_status := CASE
    WHEN v_ret IS NULL AND v_ops_id IS NOT NULL AND NOT v_enfileirou THEN 'passou'
    ELSE 'falhou'
  END;

  INSERT INTO public.ops_events (fn, level, category, message, ctx)
  VALUES ('capi_guarda_selftest',
          CASE WHEN v_status = 'passou' THEN 'info' ELSE 'error' END,
          'capi_selftest',
          'capi_guarda_selftest: ' || v_status,
          jsonb_build_object(
            'selftest', true,
            'resultado', v_status,
            'lead_id_interno', v_lead_id,
            'retorno_nulo', (v_ret IS NULL),
            'bloqueio_registrado', (v_ops_id IS NOT NULL),
            'enfileirou', v_enfileirou
          ));

  RETURN jsonb_build_object(
    'resultado', v_status,
    'lead_id_interno', v_lead_id,
    'retorno_nulo', (v_ret IS NULL),
    'bloqueio_registrado', (v_ops_id IS NOT NULL),
    'enfileirou', v_enfileirou
  );
END;
$function$;