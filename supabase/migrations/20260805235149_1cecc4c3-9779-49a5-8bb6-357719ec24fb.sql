CREATE OR REPLACE FUNCTION public.stamp_negocio_equipe_gerente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_gerente uuid;
BEGIN
  IF NEW.equipe_gerente_auth_id IS NULL
     AND (NEW.fase = 'ganho' OR NEW.data_assinatura IS NOT NULL)
     AND NEW.auth_user_id IS NOT NULL THEN
    SELECT tm.gerente_id INTO v_gerente FROM public.team_members tm
     WHERE tm.user_id = NEW.auth_user_id LIMIT 1;
    IF v_gerente IS NOT NULL THEN NEW.equipe_gerente_auth_id := v_gerente; END IF;
  END IF;
  RETURN NEW;
END;
$function$;