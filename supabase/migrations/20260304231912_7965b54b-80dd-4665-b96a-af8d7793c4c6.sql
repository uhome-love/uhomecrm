
-- =====================================================
-- 1. INDEXES for performance on oferta_ativa_leads
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_oa_leads_lista_status ON public.oferta_ativa_leads(lista_id, status);
CREATE INDEX IF NOT EXISTS idx_oa_leads_corretor ON public.oferta_ativa_leads(corretor_id);
CREATE INDEX IF NOT EXISTS idx_oa_leads_telefone_norm ON public.oferta_ativa_leads(telefone_normalizado) WHERE telefone_normalizado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oa_leads_em_atendimento ON public.oferta_ativa_leads(em_atendimento_por, em_atendimento_ate) WHERE em_atendimento_por IS NOT NULL;

-- Index on tentativas for ranking queries
CREATE INDEX IF NOT EXISTS idx_oa_tentativas_created ON public.oferta_ativa_tentativas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oa_tentativas_corretor ON public.oferta_ativa_tentativas(corretor_id, created_at DESC);

-- =====================================================
-- 2. PARTIAL UNIQUE INDEX - prevent duplicate active leads by phone
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_oa_leads_unique_phone_active
  ON public.oferta_ativa_leads(telefone_normalizado)
  WHERE telefone_normalizado IS NOT NULL
    AND status IN ('na_fila', 'em_cooldown', 'aproveitado');

-- =====================================================
-- 3. ATOMIC LOCK FUNCTION - prevents race condition
-- =====================================================
CREATE OR REPLACE FUNCTION public.lock_lead_atomic(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_lock_minutes integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_now timestamptz := now();
  v_lock_until timestamptz := v_now + (p_lock_minutes || ' minutes')::interval;
BEGIN
  -- Attempt atomic lock: only succeeds if no one else holds a valid lock
  UPDATE oferta_ativa_leads
  SET em_atendimento_por = p_corretor_id,
      em_atendimento_ate = v_lock_until
  WHERE id = p_lead_id
    AND status IN ('na_fila', 'em_cooldown')
    AND (
      em_atendimento_por IS NULL
      OR em_atendimento_por = p_corretor_id
      OR em_atendimento_ate < v_now
    );

  IF FOUND THEN
    v_result := jsonb_build_object('locked', true, 'expires_at', v_lock_until);
  ELSE
    -- Check why it failed
    SELECT jsonb_build_object(
      'locked', false,
      'reason', CASE
        WHEN status NOT IN ('na_fila', 'em_cooldown') THEN 'lead_unavailable'
        ELSE 'locked_by_another'
      END,
      'locked_by', em_atendimento_por,
      'lock_expires', em_atendimento_ate
    ) INTO v_result
    FROM oferta_ativa_leads
    WHERE id = p_lead_id;

    IF v_result IS NULL THEN
      v_result := jsonb_build_object('locked', false, 'reason', 'not_found');
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 4. EXCLUSIVE APPROVAL FUNCTION - prevents double approval
-- =====================================================
CREATE OR REPLACE FUNCTION public.aprovar_lead_exclusivo(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_feedback text,
  p_canal text,
  p_lista_id uuid DEFAULT NULL,
  p_empreendimento text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_existing_id uuid;
  v_phone text;
BEGIN
  -- Get lead details
  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.status = 'aproveitado' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_approved', 'corretor_id', v_lead.corretor_id);
  END IF;

  IF v_lead.status NOT IN ('na_fila', 'em_cooldown') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_unavailable');
  END IF;

  -- Check if same phone is already approved by another corretor
  v_phone := v_lead.telefone_normalizado;
  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM oferta_ativa_leads
    WHERE telefone_normalizado = v_phone
      AND status = 'aproveitado'
      AND id != p_lead_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'reason', 'phone_already_approved', 'existing_lead_id', v_existing_id);
    END IF;
  END IF;

  -- Register the attempt
  INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos)
  VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, 'com_interesse', p_feedback, 3);

  -- Update lead to approved
  UPDATE oferta_ativa_leads
  SET status = 'aproveitado',
      corretor_id = p_corretor_id,
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('success', true, 'message', 'Lead aproveitado com sucesso');
END;
$$;

-- =====================================================
-- 5. CLEANUP EXPIRED LOCKS (can be called periodically)
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE oferta_ativa_leads
  SET em_atendimento_por = NULL,
      em_atendimento_ate = NULL
  WHERE em_atendimento_ate < now()
    AND em_atendimento_por IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
