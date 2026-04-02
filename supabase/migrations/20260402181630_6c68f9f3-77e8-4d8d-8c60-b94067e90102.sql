
CREATE OR REPLACE FUNCTION public.auto_remove_from_roleta_on_offline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date;
BEGIN
  -- Only act when status changes to offline/fora_empresa
  IF NEW.status IN ('fora_empresa', 'offline') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    -- Mark na_roleta = false and set saida_em
    NEW.na_roleta := false;
    NEW.saida_em := now();

    -- Deactivate from roleta_fila for today
    UPDATE roleta_fila
    SET ativo = false
    WHERE corretor_id = NEW.user_id
      AND data = v_hoje
      AND ativo = true;

    -- Mark credenciamentos as 'saiu' for today
    UPDATE roleta_credenciamentos
    SET status = 'saiu', saiu_em = now()
    WHERE corretor_id = NEW.user_id
      AND data = v_hoje
      AND status IN ('aprovado', 'pendente');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_remove_roleta_on_offline
  BEFORE UPDATE ON public.corretor_disponibilidade
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_remove_from_roleta_on_offline();
