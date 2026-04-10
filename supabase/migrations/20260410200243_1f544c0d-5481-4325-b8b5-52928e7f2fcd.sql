-- Drop old trigger (UPDATE only)
DROP TRIGGER IF EXISTS trg_fix_aceite_on_corretor_assign ON pipeline_leads;

-- Replace function: set 'aceito' (not 'pendente') and fill aceito_em
CREATE OR REPLACE FUNCTION fn_fix_aceite_on_corretor_assign()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If corretor is assigned and aceite_status is still pendente_distribuicao, auto-accept
  IF NEW.corretor_id IS NOT NULL 
     AND NEW.aceite_status = 'pendente_distribuicao'
  THEN
    -- On INSERT: always fix
    -- On UPDATE: only if corretor actually changed
    IF TG_OP = 'INSERT' 
       OR (OLD.corretor_id IS NULL OR OLD.corretor_id IS DISTINCT FROM NEW.corretor_id)
    THEN
      NEW.aceite_status := 'aceito';
      NEW.aceito_em := COALESCE(NEW.aceito_em, now());
      NEW.distribuido_em := COALESCE(NEW.distribuido_em, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger for BOTH INSERT and UPDATE
CREATE TRIGGER trg_fix_aceite_on_corretor_assign
  BEFORE INSERT OR UPDATE ON pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_fix_aceite_on_corretor_assign();