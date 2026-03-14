CREATE OR REPLACE FUNCTION public.reset_roleta_turno()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hour int := extract(hour from (now() AT TIME ZONE 'America/Sao_Paulo'));
  v_min int := extract(minute from (now() AT TIME ZONE 'America/Sao_Paulo'));
  v_prev_janela text;
  v_fila_deactivated int := 0;
  v_fila_reset int := 0;
  v_disp_reset int := 0;
BEGIN
  -- Determine which shift just ended
  IF v_hour = 12 AND v_min < 30 THEN
    v_prev_janela := 'manha';
  ELSIF (v_hour = 18 AND v_min >= 30) OR (v_hour = 19 AND v_min < 30) THEN
    v_prev_janela := 'tarde';
  ELSIF v_hour = 23 AND v_min >= 30 THEN
    v_prev_janela := 'noturna';
  ELSE
    v_prev_janela := NULL;
  END IF;

  -- Deactivate fila entries from the previous shift
  IF v_prev_janela IS NOT NULL THEN
    UPDATE roleta_fila
    SET ativo = false
    WHERE data = v_today
      AND ativo = true
      AND janela = v_prev_janela;
    GET DIAGNOSTICS v_fila_deactivated = ROW_COUNT;
  END IF;

  -- Reset lead counters for remaining active entries
  UPDATE roleta_fila
  SET leads_recebidos = 0
  WHERE data = v_today
    AND ativo = true;
  GET DIAGNOSTICS v_fila_reset = ROW_COUNT;

  -- Reset turno counter on disponibilidade
  UPDATE corretor_disponibilidade
  SET leads_recebidos_turno = 0
  WHERE na_roleta = true;
  GET DIAGNOSTICS v_disp_reset = ROW_COUNT;

  -- Persist execution to ops_events for unified observability
  INSERT INTO ops_events (fn, level, category, message, ctx)
  VALUES (
    'reset-roleta-turno',
    'info',
    'business',
    'Shift reset executed',
    jsonb_build_object(
      'janela_desativada', coalesce(v_prev_janela, 'none'),
      'hora_brt', v_hour,
      'fila_deactivated', v_fila_deactivated,
      'fila_reset', v_fila_reset,
      'disp_reset', v_disp_reset
    )
  );
END;
$$;