CREATE OR REPLACE FUNCTION public.enforce_data_assinatura_ganho()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fase = 'ganho' AND COALESCE(NEW.status, 'ativo') = 'ativo' AND NEW.data_assinatura IS NULL THEN
    RAISE EXCEPTION 'Informe a data de assinatura para marcar o negócio como Ganho.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_data_assinatura_ganho ON public.negocios;
CREATE TRIGGER trg_enforce_data_assinatura_ganho
BEFORE INSERT OR UPDATE ON public.negocios
FOR EACH ROW EXECUTE FUNCTION public.enforce_data_assinatura_ganho();