CREATE OR REPLACE FUNCTION public.guard_decidir_lead_estagnado_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.lead_em_estado_final(NEW.id)
     AND (
       NEW.corretor_id IS DISTINCT FROM OLD.corretor_id
       OR NEW.aceite_status IS DISTINCT FROM OLD.aceite_status
       OR NEW.stage_id IS DISTINCT FROM OLD.stage_id
     ) THEN
    RAISE EXCEPTION 'Lead em etapa final não pode ser redistribuído'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;