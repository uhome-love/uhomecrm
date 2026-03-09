
-- Function to reset lead counts at shift boundaries
CREATE OR REPLACE FUNCTION public.reset_roleta_turno()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  -- Reset roleta_fila lead counts for today's active entries
  UPDATE roleta_fila
  SET leads_recebidos = 0
  WHERE data = v_today AND ativo = true;

  -- Reset corretor_disponibilidade lead counts for active corretors
  UPDATE corretor_disponibilidade
  SET leads_recebidos_turno = 0, updated_at = now()
  WHERE na_roleta = true;

  RAISE LOG 'Roleta turno reset at %', (now() AT TIME ZONE 'America/Sao_Paulo')::text;
END;
$$;
