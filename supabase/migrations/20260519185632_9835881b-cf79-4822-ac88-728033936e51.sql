CREATE OR REPLACE FUNCTION public.skip_oa_lead(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_lista_id uuid,
  p_skip_minutes integer DEFAULT 30,
  p_session_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_skip_until timestamptz := now() + (p_skip_minutes || ' minutes')::interval;
BEGIN
  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.em_atendimento_por IS NOT NULL
     AND v_lead.em_atendimento_por <> p_corretor_id
     AND NOT has_role(p_corretor_id, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_locked_by_user');
  END IF;

  UPDATE oferta_ativa_leads
  SET em_atendimento_por = NULL,
      em_atendimento_ate = NULL,
      proxima_tentativa_apos = v_skip_until
  WHERE id = p_lead_id;

  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, session_id, metadata)
  VALUES ('lead_skipped', p_corretor_id, p_lead_id, p_lista_id, p_session_id,
          jsonb_build_object('skip_until', v_skip_until, 'skip_minutes', p_skip_minutes));

  RETURN jsonb_build_object('ok', true, 'skip_until', v_skip_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_oa_lead(uuid,uuid,uuid,integer,text) TO authenticated;