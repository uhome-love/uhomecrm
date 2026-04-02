
CREATE OR REPLACE FUNCTION public.auto_remove_from_roleta_on_offline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date;
BEGIN
  -- Only remove from roleta for offline, fora_empresa, em_pausa
  -- Keep in roleta for: na_empresa, em_visita, em_plantao
  IF NEW.status IN ('offline', 'fora_empresa', 'em_pausa') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    NEW.na_roleta := false;
    NEW.saida_em := now();
    UPDATE roleta_fila
    SET ativo = false
    WHERE corretor_id = NEW.user_id
      AND data = v_hoje
      AND ativo = true;
    UPDATE roleta_credenciamentos
    SET status = 'saiu', saiu_em = now()
    WHERE corretor_id = NEW.user_id
      AND data = v_hoje
      AND status IN ('aprovado', 'pendente');
  END IF;
  RETURN NEW;
END;
$$;
