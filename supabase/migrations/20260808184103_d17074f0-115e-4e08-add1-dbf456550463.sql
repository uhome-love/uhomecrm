-- 1) Autoteste da guarda de meta_lead_id
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

  -- Marca o registro de bloqueio gerado pelo teste para excluí-lo dos contadores
  UPDATE public.ops_events
     SET ctx = COALESCE(ctx, '{}'::jsonb) || jsonb_build_object('selftest', true)
   WHERE id = (
     SELECT id FROM public.ops_events
      WHERE category = 'capi_bloqueado_sem_lead_id'
        AND ctx->>'event_name' = 'GuardaSelfTest'
        AND created_at > now() - interval '5 minutes'
      ORDER BY created_at DESC
      LIMIT 1
   )
  RETURNING id INTO v_ops_id;

  SELECT EXISTS (
    SELECT 1 FROM public.meta_capi_queue WHERE event_name = 'GuardaSelfTest'
  ) INTO v_enfileirou;

  -- Limpeza: nada sintético pode sobrar na fila
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

REVOKE ALL ON FUNCTION public.capi_guarda_selftest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capi_guarda_selftest() TO service_role;

-- 2) Cobertura do evento Venda (7 dias, BRT), só leitura
CREATE OR REPLACE FUNCTION public.capi_venda_cobertura_7d()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  WITH base AS (
    SELECT n.id,
           n.nome_cliente,
           n.empreendimento,
           COALESCE(n.pipeline_lead_id, n.lead_id) AS lead_ref,
           COALESCE(
             (n.data_assinatura::timestamptz + interval '3 hours'),
             n.fase_changed_at,
             n.updated_at
           ) AS ref_at
      FROM public.negocios n
     WHERE n.fase = 'ganho'
       AND COALESCE(n.status, 'ativo') = 'ativo'
  ),
  janela AS (
    SELECT b.*,
           pl.meta_lead_id,
           EXISTS (
             SELECT 1 FROM public.meta_capi_queue q
              WHERE q.event_name = 'Venda'
                AND q.lead_id = b.lead_ref
                AND q.created_at > now() - interval '7 days'
           ) AS tem_evento
      FROM base b
      LEFT JOIN public.pipeline_leads pl ON pl.id = b.lead_ref
     WHERE b.ref_at > now() - interval '7 days'
  )
  SELECT jsonb_build_object(
    'ganhos_total', (SELECT count(*) FROM janela),
    'ganhos_elegiveis', (SELECT count(*) FROM janela WHERE meta_lead_id IS NOT NULL AND btrim(meta_lead_id) <> ''),
    'ganhos_elegiveis_maduros', (
      SELECT count(*) FROM janela
       WHERE meta_lead_id IS NOT NULL AND btrim(meta_lead_id) <> ''
         AND ref_at < now() - interval '6 hours'
    ),
    'eventos_venda_7d', (
      SELECT count(*) FROM public.meta_capi_queue
       WHERE event_name = 'Venda' AND created_at > now() - interval '7 days'
    ),
    'sem_evento', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'negocio_id', id, 'cliente', nome_cliente,
               'empreendimento', empreendimento, 'ref_at', ref_at))
        FROM janela
       WHERE meta_lead_id IS NOT NULL AND btrim(meta_lead_id) <> ''
         AND ref_at < now() - interval '6 hours'
         AND NOT tem_evento
    ), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.capi_venda_cobertura_7d() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capi_venda_cobertura_7d() TO authenticated, service_role;