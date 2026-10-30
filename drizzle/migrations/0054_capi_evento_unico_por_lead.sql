CREATE OR REPLACE FUNCTION public.enqueue_meta_capi_event(p_lead_id uuid, p_event_name text, p_event_time timestamp with time zone DEFAULT now(), p_custom_data jsonb DEFAULT '{}'::jsonb, p_lead_event_source text DEFAULT 'UhomeSales'::text, p_action_source text DEFAULT 'system_generated'::text, p_event_source_url text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lead record; v_event_id text; v_email_hash text; v_phone_hash text; v_fn_hash text; v_ln_hash text;
  v_zp_hash text; v_country_hash text; v_ext_hash text; v_user_data jsonb; v_payload jsonb; v_nome_norm text;
  v_first text; v_last text; v_ua text; v_ip text; v_time timestamptz; v_has_meta_id boolean;
  v_has_ctwa boolean; v_action_src text; v_negocio_id text;
BEGIN
  IF p_lead_id IS NULL OR p_event_name IS NULL THEN RETURN NULL; END IF;

  v_time := COALESCE(p_event_time, now());
  IF v_time < now() - interval '7 days' THEN RETURN NULL; END IF;
  IF v_time > now() THEN v_time := now(); END IF;

  SELECT id, email, telefone, meta_lead_id, ctwa_clid, nome, empreendimento, cep,
         fbc, fbp, client_user_agent, client_ip_address, origem, created_at
    INTO v_lead FROM public.pipeline_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_has_meta_id := (v_lead.meta_lead_id IS NOT NULL AND btrim(v_lead.meta_lead_id) <> '');
  v_has_ctwa    := (v_lead.ctwa_clid IS NOT NULL AND btrim(v_lead.ctwa_clid) <> '');

  IF NOT v_has_meta_id AND NOT v_has_ctwa THEN
    BEGIN
      INSERT INTO public.ops_events (fn, level, category, message, ctx)
      VALUES ('enqueue_meta_capi_event','warn','capi_bloqueado_sem_lead_id',
        format('CAPI bloqueado sem identificador (meta_lead_id/ctwa_clid): %s', p_event_name),
        jsonb_build_object('lead_id_interno', p_lead_id,'event_name', p_event_name,'origem', v_lead.origem,'lead_created_at', v_lead.created_at));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NULL;
  END IF;

  -- Um evento por lead por evento (sem horário). Venda: um por negócio.
  IF p_event_name = 'Venda' THEN
    v_negocio_id := NULLIF(COALESCE(p_custom_data, '{}'::jsonb)->>'negocio_id', '');
    v_event_id := md5(p_lead_id::text || '|Venda|' || COALESCE(v_negocio_id, ''));
    IF v_negocio_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.meta_capi_queue q
       WHERE q.event_name = 'Venda'
         AND q.payload->'custom_data'->>'negocio_id' = v_negocio_id
         AND q.status IN ('pending','processing','sent')) THEN
      RETURN NULL;
    END IF;
  ELSE
    v_event_id := md5(p_lead_id::text || '|' || p_event_name);
    IF EXISTS (
      SELECT 1 FROM public.meta_capi_queue q
       WHERE q.lead_id = p_lead_id AND q.event_name = p_event_name
         AND q.status IN ('pending','processing','sent')) THEN
      RETURN NULL;
    END IF;
  END IF;

  v_email_hash := public._capi_sha256(v_lead.email);
  v_phone_hash := public._capi_sha256(public._capi_normalize_phone(v_lead.telefone));
  v_ext_hash   := public._capi_sha256(p_lead_id::text);

  v_nome_norm := lower(btrim(public.unaccent(COALESCE(v_lead.nome, ''))));
  IF v_nome_norm <> '' THEN
    IF position(' ' in v_nome_norm) > 0 THEN
      v_first := split_part(v_nome_norm, ' ', 1);
      v_last  := NULLIF(btrim(substring(v_nome_norm from position(' ' in v_nome_norm) + 1)), '');
    ELSE
      v_first := v_nome_norm; v_last := NULL;
    END IF;
    v_fn_hash := public._capi_sha256_norm(v_first);
    v_ln_hash := public._capi_sha256_norm(v_last);
  END IF;

  v_country_hash := public._capi_sha256_norm('br');
  v_zp_hash      := public._capi_sha256(NULLIF(regexp_replace(COALESCE(v_lead.cep, ''), '\D', '', 'g'), ''));

  v_user_data := '{}'::jsonb;
  IF v_email_hash IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('em', jsonb_build_array(v_email_hash)); END IF;
  IF v_phone_hash IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('ph', jsonb_build_array(v_phone_hash)); END IF;
  IF v_fn_hash IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('fn', jsonb_build_array(v_fn_hash)); END IF;
  IF v_ln_hash IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('ln', jsonb_build_array(v_ln_hash)); END IF;
  IF v_zp_hash IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('zp', jsonb_build_array(v_zp_hash)); END IF;
  IF v_country_hash IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('country', jsonb_build_array(v_country_hash)); END IF;
  IF v_ext_hash IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('external_id', jsonb_build_array(v_ext_hash)); END IF;
  IF v_has_meta_id THEN v_user_data := v_user_data || jsonb_build_object('lead_id', btrim(v_lead.meta_lead_id)); END IF;
  IF v_has_ctwa THEN v_user_data := v_user_data || jsonb_build_object('ctwa_clid', btrim(v_lead.ctwa_clid)); END IF;
  IF v_lead.fbc IS NOT NULL AND btrim(v_lead.fbc) <> '' THEN v_user_data := v_user_data || jsonb_build_object('fbc', v_lead.fbc); END IF;
  IF v_lead.fbp IS NOT NULL AND btrim(v_lead.fbp) <> '' THEN v_user_data := v_user_data || jsonb_build_object('fbp', v_lead.fbp); END IF;

  v_ua := NULLIF(btrim(COALESCE(v_lead.client_user_agent, '')), '');
  IF v_ua IS NOT NULL AND (
       v_ua ILIKE 'Deno/%' OR v_ua ILIKE '%SupabaseEdgeRuntime%' OR
       v_ua ILIKE 'Make/%' OR v_ua ILIKE '%node-fetch%' OR v_ua ILIKE '%axios/%' OR
       v_ua ILIKE '%curl/%' OR v_ua ILIKE '%python-requests%') THEN
    v_ua := NULL;
  END IF;
  IF v_ua IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('client_user_agent', v_ua); END IF;
  v_ip := NULLIF(btrim(COALESCE(v_lead.client_ip_address, '')), '');
  IF v_ua IS NOT NULL AND v_ip IS NOT NULL THEN v_user_data := v_user_data || jsonb_build_object('client_ip_address', v_ip); END IF;

  IF v_has_ctwa AND NOT v_has_meta_id THEN
    v_action_src := 'business_messaging';
  ELSE
    v_action_src := COALESCE(p_action_source, 'system_generated');
  END IF;

  v_payload := jsonb_build_object(
    'action_source', v_action_src,
    'event_name',    p_event_name,
    'event_time',    extract(epoch FROM v_time)::bigint,
    'event_id',      v_event_id,
    'user_data',     v_user_data,
    'custom_data',   jsonb_build_object('event_source','crm','lead_event_source', COALESCE(p_lead_event_source,'UhomeSales'))
                     || COALESCE(p_custom_data, '{}'::jsonb));
  IF v_action_src = 'business_messaging' THEN v_payload := v_payload || jsonb_build_object('messaging_channel','whatsapp'); END IF;
  IF p_event_source_url IS NOT NULL AND btrim(p_event_source_url) <> '' THEN
    v_payload := v_payload || jsonb_build_object('event_source_url', p_event_source_url);
  END IF;

  INSERT INTO public.meta_capi_queue (event_id, lead_id, event_name, event_time, payload)
  VALUES (v_event_id, p_lead_id, p_event_name, v_time, v_payload)
  ON CONFLICT (event_id) DO UPDATE
     SET status = 'pending', attempts = 0, last_error = NULL, payload = EXCLUDED.payload
   WHERE meta_capi_queue.status IN ('failed','skipped');

  RETURN v_event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
     AND EXISTS (SELECT 1 FROM public.pipeline_stages s
                  WHERE s.id = NEW.stage_id
                    AND s.tipo::text IN ('qualificacao','aquecimento','visita','pos_visita','documentacao','proposta','contrato_gerado','venda'))
     AND NOT EXISTS (SELECT 1 FROM public.meta_capi_queue q
                      WHERE q.lead_id = NEW.id AND q.event_name = 'LeadQualificado'
                        AND q.status IN ('pending','processing','sent')) THEN
    BEGIN
      PERFORM public.enqueue_meta_capi_event(
        p_lead_id => NEW.id,
        p_event_name => 'LeadQualificado',
        p_event_time => now(),
        p_custom_data => '{}'::jsonb,
        p_lead_event_source => 'UhomeSales'
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.ops_events (fn, level, category, message, ctx, error_detail)
      VALUES ('trg_pipeline_lead_capi', 'warn', 'capi', 'capi_enqueue_failed_ignored',
              jsonb_build_object('lead_id', NEW.id, 'event', 'LeadQualificado'),
              SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;
  RETURN NEW;
END;
$function$;