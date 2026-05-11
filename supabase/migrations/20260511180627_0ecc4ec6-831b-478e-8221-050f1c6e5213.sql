
CREATE OR REPLACE FUNCTION public.validate_reengajamento_canal()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.canal NOT IN ('evolution', 'meta') THEN
    RAISE EXCEPTION 'canal deve ser evolution ou meta';
  END IF;
  IF NEW.canal = 'meta' AND (NEW.meta_template_name IS NULL OR NEW.meta_template_name = '') THEN
    RAISE EXCEPTION 'meta_template_name obrigatório quando canal=meta';
  END IF;
  IF NEW.delay_min_seconds < 2 THEN NEW.delay_min_seconds := 2; END IF;
  IF NEW.delay_max_seconds < NEW.delay_min_seconds THEN NEW.delay_max_seconds := NEW.delay_min_seconds; END IF;
  RETURN NEW;
END;
$$;
