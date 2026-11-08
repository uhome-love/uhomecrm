CREATE OR REPLACE FUNCTION public.elegivel_roleta_domingo(p_corretor_id uuid, p_domingo date)
 RETURNS TABLE(elegivel boolean, presencas_semana integer, visitas_semana integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_seg date := p_domingo - 6;
  v_sab date := p_domingo - 1;
  v_pres int; v_vis numeric; v_user uuid;
BEGIN
  -- Semana = segunda a domingo (inclui o próprio domingo): visita feita no domingo conta para a semana atual.
  SELECT COUNT(DISTINCT (data, turno))::int INTO v_pres FROM public.roleta_presencas
   WHERE corretor_id = p_corretor_id AND data BETWEEN v_seg AND v_sab AND turno IN ('manha','tarde') AND status = 'na_empresa';
  SELECT user_id INTO v_user FROM public.profiles WHERE id = p_corretor_id;
  v_vis := COALESCE(public.roleta_visitas_realizadas_periodo(COALESCE(v_user, p_corretor_id), v_seg, p_domingo), 0);
  presencas_semana := COALESCE(v_pres, 0);
  visitas_semana   := floor(v_vis)::int;
  IF public.roleta_crm_gate_ativo() THEN
    elegivel := v_vis >= public.roleta_visitas_meta();
  ELSE
    elegivel := presencas_semana >= 4 AND v_vis >= 2;
  END IF;
  RETURN NEXT;
END;
$function$;