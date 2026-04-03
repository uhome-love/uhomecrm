
-- Fix the 3-arg overload of aceitar_lead to accept both statuses
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

  IF v_lead.aceite_expira_em IS NOT NULL AND v_lead.aceite_expira_em < v_now THEN
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
