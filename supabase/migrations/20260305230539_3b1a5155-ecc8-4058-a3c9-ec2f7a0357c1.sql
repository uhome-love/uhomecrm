
-- 1) Create oa_events observability table
CREATE TABLE public.oa_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- lead_served, lead_locked, call_started, call_finished, lead_skipped, lead_discarded, visit_created, lock_expired, lock_conflict
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.oferta_ativa_leads(id) ON DELETE SET NULL,
  lista_id uuid REFERENCES public.oferta_ativa_listas(id) ON DELETE SET NULL,
  session_id text,
  attempt_id uuid REFERENCES public.oferta_ativa_tentativas(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for dashboard queries
CREATE INDEX idx_oa_events_type_created ON public.oa_events(event_type, created_at DESC);
CREATE INDEX idx_oa_events_user_created ON public.oa_events(user_id, created_at DESC);
CREATE INDEX idx_oa_events_lead ON public.oa_events(lead_id) WHERE lead_id IS NOT NULL;

-- RLS: admins/gestores can read all, users can read own, all authenticated can insert
ALTER TABLE public.oa_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own events" ON public.oa_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and gestores can view all events" ON public.oa_events FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users can view own events" ON public.oa_events FOR SELECT
  USING (auth.uid() = user_id);

-- 2) Add unique index on idempotency_key to enforce server-side idempotency
CREATE UNIQUE INDEX idx_oa_tentativas_idempotency ON public.oferta_ativa_tentativas(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3) Add phone-level dedup to fetch_next_lead: exclude leads whose phone was already attempted today
CREATE OR REPLACE FUNCTION public.fetch_next_lead(p_corretor_id uuid, p_lista_id uuid, p_lock_minutes integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_now timestamptz := now();
  v_today_start timestamptz := date_trunc('day', v_now);
  v_lock_until timestamptz := v_now + (p_lock_minutes || ' minutes')::interval;
  v_phones_worked text[];
BEGIN
  -- Clean expired locks first
  UPDATE oferta_ativa_leads
  SET em_atendimento_por = NULL, em_atendimento_ate = NULL
  WHERE em_atendimento_ate < v_now AND em_atendimento_por IS NOT NULL;

  -- Collect phones already worked by this corretor today (phone-level dedup)
  SELECT array_agg(DISTINCT l.telefone_normalizado)
  INTO v_phones_worked
  FROM oferta_ativa_tentativas t
  JOIN oferta_ativa_leads l ON l.id = t.lead_id
  WHERE t.corretor_id = p_corretor_id
    AND t.created_at >= v_today_start
    AND l.telefone_normalizado IS NOT NULL;

  -- Select best eligible lead with composite scoring
  SELECT l.* INTO v_lead
  FROM oferta_ativa_leads l
  WHERE l.lista_id = p_lista_id
    AND l.status IN ('na_fila', 'em_cooldown')
    AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
    AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    -- Anti-repeat: not attempted by this corretor today
    AND NOT EXISTS (
      SELECT 1 FROM oferta_ativa_tentativas t
      WHERE t.lead_id = l.id
        AND t.corretor_id = p_corretor_id
        AND t.created_at >= v_today_start
    )
    -- Phone-level dedup: skip if same phone was already worked
    AND (l.telefone_normalizado IS NULL OR v_phones_worked IS NULL OR NOT (l.telefone_normalizado = ANY(v_phones_worked)))
  ORDER BY
    l.tentativas_count ASC,
    EXTRACT(EPOCH FROM (v_now - COALESCE(l.ultima_tentativa, l.created_at))) DESC,
    random()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- Fallback: without anti-repeat (all unique leads exhausted)
    SELECT l.* INTO v_lead
    FROM oferta_ativa_leads l
    WHERE l.lista_id = p_lista_id
      AND l.status IN ('na_fila', 'em_cooldown')
      AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
      AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    ORDER BY l.tentativas_count ASC, random()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('found', false, 'reason', 'no_leads_available');
    END IF;
  END IF;

  -- Lock the lead atomically
  UPDATE oferta_ativa_leads
  SET em_atendimento_por = p_corretor_id,
      em_atendimento_ate = v_lock_until
  WHERE id = v_lead.id;

  -- Log event
  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, metadata)
  VALUES ('lead_served', p_corretor_id, v_lead.id, p_lista_id,
    jsonb_build_object('tentativas_count', v_lead.tentativas_count, 'status', v_lead.status));

  RETURN jsonb_build_object(
    'found', true,
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'nome', v_lead.nome,
      'telefone', v_lead.telefone,
      'telefone2', v_lead.telefone2,
      'email', v_lead.email,
      'empreendimento', v_lead.empreendimento,
      'campanha', v_lead.campanha,
      'origem', v_lead.origem,
      'data_lead', v_lead.data_lead,
      'observacoes', v_lead.observacoes,
      'tentativas_count', v_lead.tentativas_count,
      'lista_id', v_lead.lista_id,
      'status', v_lead.status
    ),
    'lock_expires_at', v_lock_until
  );
END;
$function$;

-- 4) Update finalizar_tentativa_v2 to log events + handle visita_marcada transactionally
CREATE OR REPLACE FUNCTION public.finalizar_tentativa_v2(p_lead_id uuid, p_corretor_id uuid, p_canal text, p_resultado text, p_feedback text, p_lista_id uuid DEFAULT NULL::uuid, p_empreendimento text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_visita_marcada boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_lista oferta_ativa_listas%ROWTYPE;
  v_existing_attempt uuid;
  v_attempt_id uuid;
  v_pontos integer := 1;
  v_cooldown_intervals integer[] := ARRAY[15, 60, 240, 1440];
  v_cooldown_minutes integer;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_attempt
    FROM oferta_ativa_tentativas
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Tentativa já registrada');
    END IF;
  END IF;

  -- Get lead with row lock
  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  -- Handle "com_interesse" (approval)
  IF p_resultado = 'com_interesse' THEN
    IF v_lead.telefone_normalizado IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM oferta_ativa_leads
        WHERE telefone_normalizado = v_lead.telefone_normalizado
          AND status = 'aproveitado'
          AND id != p_lead_id
      ) THEN
        RETURN jsonb_build_object('success', false, 'reason', 'phone_already_approved');
      END IF;
    END IF;

    IF v_lead.status = 'aproveitado' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'already_approved');
    END IF;

    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, 'com_interesse', p_feedback, 3, p_idempotency_key)
    RETURNING id INTO v_attempt_id;

    UPDATE oferta_ativa_leads SET
      status = 'aproveitado',
      corretor_id = p_corretor_id,
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
    WHERE id = p_lead_id;

    -- Log event
    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object('resultado', 'com_interesse', 'canal', p_canal, 'pontos', 3, 'visita_marcada', p_visita_marcada));

    RETURN jsonb_build_object('success', true, 'resultado', 'com_interesse', 'pontos', 3, 'attempt_id', v_attempt_id);
  END IF;

  -- Calculate points
  IF p_resultado = 'numero_errado' THEN v_pontos := 0;
  ELSIF p_resultado = 'sem_interesse' THEN v_pontos := 1;
  ELSIF p_resultado = 'nao_atendeu' THEN v_pontos := 1;
  END IF;

  -- Insert attempt
  INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
  VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, p_resultado, p_feedback, v_pontos, p_idempotency_key)
  RETURNING id INTO v_attempt_id;

  -- Update lead based on result
  IF p_resultado IN ('numero_errado', 'sem_interesse') THEN
    UPDATE oferta_ativa_leads SET
      status = 'descartado',
      motivo_descarte = p_resultado,
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
    WHERE id = p_lead_id;

    -- Log discard event
    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('lead_discarded', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object('motivo', p_resultado, 'canal', p_canal));

  ELSIF p_resultado = 'nao_atendeu' THEN
    SELECT * INTO v_lista FROM oferta_ativa_listas WHERE id = COALESCE(p_lista_id, v_lead.lista_id);
    v_cooldown_minutes := v_cooldown_intervals[LEAST(v_lead.tentativas_count + 1, array_length(v_cooldown_intervals, 1))];

    IF v_lead.tentativas_count + 1 >= COALESCE(v_lista.max_tentativas, 3) THEN
      UPDATE oferta_ativa_leads SET
        status = 'descartado',
        motivo_descarte = 'max_tentativas',
        tentativas_count = tentativas_count + 1,
        ultima_tentativa = now(),
        em_atendimento_por = NULL,
        em_atendimento_ate = NULL
      WHERE id = p_lead_id;

      INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
      VALUES ('lead_discarded', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
        jsonb_build_object('motivo', 'max_tentativas', 'tentativas', v_lead.tentativas_count + 1));
    ELSE
      UPDATE oferta_ativa_leads SET
        status = 'em_cooldown',
        proxima_tentativa_apos = now() + (v_cooldown_minutes || ' minutes')::interval,
        tentativas_count = tentativas_count + 1,
        ultima_tentativa = now(),
        em_atendimento_por = NULL,
        em_atendimento_ate = NULL
      WHERE id = p_lead_id;
    END IF;
  END IF;

  -- Log finish event
  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
  VALUES ('call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
    jsonb_build_object('resultado', p_resultado, 'canal', p_canal, 'pontos', v_pontos, 'visita_marcada', p_visita_marcada));

  RETURN jsonb_build_object('success', true, 'resultado', p_resultado, 'pontos', v_pontos, 'visita_marcada', p_visita_marcada, 'attempt_id', v_attempt_id);
END;
$function$;

-- 5) Update cleanup_expired_locks to log events
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_expired record;
BEGIN
  -- Log expired locks before cleaning
  FOR v_expired IN
    SELECT id, em_atendimento_por, lista_id FROM oferta_ativa_leads
    WHERE em_atendimento_ate < now() AND em_atendimento_por IS NOT NULL
  LOOP
    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, metadata)
    VALUES ('lock_expired', v_expired.em_atendimento_por, v_expired.id, v_expired.lista_id,
      jsonb_build_object('reason', 'ttl_expired'));
  END LOOP;

  UPDATE oferta_ativa_leads
  SET em_atendimento_por = NULL,
      em_atendimento_ate = NULL
  WHERE em_atendimento_ate < now()
    AND em_atendimento_por IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
