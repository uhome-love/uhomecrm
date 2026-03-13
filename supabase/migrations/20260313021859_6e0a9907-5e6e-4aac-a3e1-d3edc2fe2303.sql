
-- 1. Atomic lead acceptance RPC with FOR UPDATE to prevent race conditions
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
  -- Lock the row with FOR UPDATE to prevent concurrent acceptance
  SELECT id, corretor_id, aceite_status, aceite_expira_em
  INTO v_lead
  FROM pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  -- Lead not found
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  -- Lead no longer belongs to this corretor (was redistributed)
  IF v_lead.corretor_id IS DISTINCT FROM p_corretor_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_your_lead');
  END IF;

  -- Lead is not in pending status
  IF v_lead.aceite_status != 'pendente' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_pending', 'current_status', v_lead.aceite_status);
  END IF;

  -- SLA expired
  IF v_lead.aceite_expira_em IS NOT NULL AND v_lead.aceite_expira_em < v_now THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sla_expired');
  END IF;

  -- All checks passed — accept the lead atomically
  UPDATE pipeline_leads
  SET aceite_status = 'aceito',
      aceito_em = v_now,
      updated_at = v_now
  WHERE id = p_lead_id;

  -- Update roleta_distribuicoes
  UPDATE roleta_distribuicoes
  SET status = 'aceito', aceito_em = v_now
  WHERE lead_id = p_lead_id AND status = 'aguardando';

  -- Log in distribuicao_historico
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

-- 2. Atomic lead rejection RPC
CREATE OR REPLACE FUNCTION public.rejeitar_lead(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_motivo text DEFAULT 'outro'
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
  SELECT id, corretor_id, aceite_status
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

  IF v_lead.aceite_status NOT IN ('pendente') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_pending');
  END IF;

  -- Reject: clear corretor and set for redistribution
  UPDATE pipeline_leads
  SET aceite_status = 'pendente_distribuicao',
      corretor_id = NULL,
      distribuido_em = NULL,
      aceite_expira_em = NULL,
      updated_at = v_now
  WHERE id = p_lead_id;

  -- Update roleta_distribuicoes
  UPDATE roleta_distribuicoes
  SET status = 'recusado'
  WHERE lead_id = p_lead_id AND status = 'aguardando';

  -- Log
  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao)
  VALUES (p_lead_id, p_corretor_id, 'rejeitado', p_motivo);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Performance indexes for lead escalation queries
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_aceite_pending
  ON pipeline_leads (aceite_status, aceite_expira_em)
  WHERE aceite_status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_pendente_dist
  ON pipeline_leads (aceite_status)
  WHERE aceite_status = 'pendente_distribuicao';

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_corretor_status
  ON pipeline_leads (corretor_id, aceite_status);

CREATE INDEX IF NOT EXISTS idx_distribuicao_historico_recent
  ON distribuicao_historico (created_at DESC, acao);
