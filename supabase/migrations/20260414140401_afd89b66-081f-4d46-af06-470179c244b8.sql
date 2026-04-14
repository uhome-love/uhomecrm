
-- 1. Fix reciclar_leads_expirados: add 30s buffer + safe UPDATE
CREATE OR REPLACE FUNCTION public.reciclar_leads_expirados()
RETURNS TABLE(
  lead_id uuid,
  corretor_anterior uuid,
  lead_nome text,
  lead_empreendimento text,
  lead_telefone text,
  segmento_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead record;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.corretor_id, pl.segmento_id AS seg_id, pl.distribuido_em, pl.nome, pl.empreendimento, pl.telefone
    FROM pipeline_leads pl
    WHERE pl.aceite_expira_em < (now() - interval '30 seconds')
      AND pl.aceite_status IN ('pendente', 'aguardando_aceite')
      AND pl.corretor_id IS NOT NULL
  LOOP
    INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao, motivo_rejeicao, tempo_resposta_seg)
    VALUES (
      v_lead.id,
      v_lead.corretor_id,
      v_lead.seg_id,
      'timeout',
      'tempo_excedido',
      EXTRACT(EPOCH FROM (now() - v_lead.distribuido_em))::integer
    );

    -- Safe UPDATE: only recycle if still pending (prevents overwriting accepted leads)
    UPDATE pipeline_leads
    SET corretor_id = NULL,
        distribuido_em = NULL,
        aceite_expira_em = NULL,
        aceite_status = 'pendente_distribuicao',
        updated_at = now()
    WHERE id = v_lead.id
      AND aceite_status IN ('pendente', 'aguardando_aceite');

    -- Only return if the UPDATE actually changed the row
    IF FOUND THEN
      lead_id := v_lead.id;
      corretor_anterior := v_lead.corretor_id;
      lead_nome := v_lead.nome;
      lead_empreendimento := v_lead.empreendimento;
      lead_telefone := v_lead.telefone;
      segmento_id := v_lead.seg_id;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- 2. Fix aceitar_lead: add 30s grace period for clock drift
CREATE OR REPLACE FUNCTION public.aceitar_lead(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_status_inicial text DEFAULT 'ligando_agora'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_now timestamptz := now();
BEGIN
  SELECT id, corretor_id, aceite_status, aceite_expira_em
  INTO v_lead
  FROM pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS DISTINCT FROM p_corretor_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_your_lead');
  END IF;

  -- Accept both 'pendente' and 'aguardando_aceite' statuses
  IF v_lead.aceite_status NOT IN ('pendente', 'aguardando_aceite') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_pending', 'current_status', v_lead.aceite_status);
  END IF;

  -- Grace period: allow acceptance up to 30 seconds past expiration
  IF v_lead.aceite_expira_em IS NOT NULL AND v_lead.aceite_expira_em < (v_now - interval '30 seconds') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sla_expired');
  END IF;

  UPDATE pipeline_leads
  SET aceite_status = 'aceito',
      aceito_em = v_now,
      updated_at = v_now
  WHERE id = p_lead_id;

  UPDATE roleta_distribuicoes
  SET status = 'aceito', aceito_em = v_now
  WHERE lead_id = p_lead_id AND status = 'aguardando';

  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, tempo_resposta_seg)
  VALUES (
    p_lead_id,
    p_corretor_id,
    'aceito',
    EXTRACT(EPOCH FROM (v_now - COALESCE(v_lead.aceite_expira_em - interval '10 minutes', v_now)))::int
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
