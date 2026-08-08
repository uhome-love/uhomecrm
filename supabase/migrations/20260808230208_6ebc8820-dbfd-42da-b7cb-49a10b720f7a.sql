CREATE OR REPLACE FUNCTION public.enqueue_meta_capi_event_lia(
  p_ia_lead_id uuid,
  p_event_name text,
  p_event_time timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead       record;
  v_event_id   text;
  v_user_data  jsonb := '{}'::jsonb;
  v_payload    jsonb;
  v_time       timestamptz;
  v_nome_norm  text;
  v_first      text;
  v_last       text;
  v_hash       text;
BEGIN
  IF p_ia_lead_id IS NULL OR p_event_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_time := COALESCE(p_event_time, now());
  IF v_time < now() - interval '7 days' THEN RETURN NULL; END IF;
  IF v_time > now() THEN v_time := now(); END IF;

  SELECT id, nome, email, telefone, meta_lead_id, origem, created_at
    INTO v_lead
    FROM public.ia_leads
   WHERE id = p_ia_lead_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_lead.meta_lead_id IS NULL OR btrim(v_lead.meta_lead_id) = '' THEN
    BEGIN
      INSERT INTO public.ops_events (fn, level, category, message, ctx)
      VALUES (
        'enqueue_meta_capi_event_lia', 'warn', 'capi_bloqueado_sem_lead_id',
        format('CAPI Lia bloqueado sem meta_lead_id: %s', p_event_name),
        jsonb_build_object('ia_lead_id', p_ia_lead_id, 'event_name', p_event_name,
                           'origem', v_lead.origem, 'lead_created_at', v_lead.created_at)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NULL;
  END IF;

  -- Idempotencia por PAR (ia_lead_id, event_name): sem tempo no hash.
  v_event_id := md5('lia|' || p_ia_lead_id::text || '|' || p_event_name);

  v_hash := public._capi_sha256(v_lead.email);
  IF v_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('em', jsonb_build_array(v_hash));
  END IF;

  v_hash := public._capi_sha256(public._capi_normalize_phone(v_lead.telefone));
  IF v_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('ph', jsonb_build_array(v_hash));
  END IF;

  v_nome_norm := lower(btrim(public.unaccent(COALESCE(v_lead.nome, ''))));
  IF v_nome_norm <> '' THEN
    IF position(' ' in v_nome_norm) > 0 THEN
      v_first := split_part(v_nome_norm, ' ', 1);
      v_last  := NULLIF(btrim(substring(v_nome_norm from position(' ' in v_nome_norm) + 1)), '');
    ELSE
      v_first := v_nome_norm;
      v_last  := NULL;
    END IF;
    v_hash := public._capi_sha256_norm(v_first);
    IF v_hash IS NOT NULL THEN
      v_user_data := v_user_data || jsonb_build_object('fn', jsonb_build_array(v_hash));
    END IF;
    v_hash := public._capi_sha256_norm(v_last);
    IF v_hash IS NOT NULL THEN
      v_user_data := v_user_data || jsonb_build_object('ln', jsonb_build_array(v_hash));
    END IF;
  END IF;

  v_user_data := v_user_data
    || jsonb_build_object('country', jsonb_build_array(public._capi_sha256_norm('br')))
    || jsonb_build_object('lead_id', btrim(v_lead.meta_lead_id));

  v_payload := jsonb_build_object(
    'action_source', 'system_generated',
    'event_name',    p_event_name,
    'event_time',    extract(epoch FROM v_time)::bigint,
    'event_id',      v_event_id,
    'user_data',     v_user_data,
    'custom_data',   jsonb_build_object('event_source', 'lia', 'lead_event_source', 'lia')
  );

  INSERT INTO public.meta_capi_queue (event_id, lead_id, event_name, event_time, payload)
  VALUES (v_event_id, NULL, p_event_name, v_time, v_payload)
  ON CONFLICT (event_id) DO NOTHING;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_meta_capi_event_lia(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_meta_capi_event_lia(uuid, text, timestamptz) TO service_role;