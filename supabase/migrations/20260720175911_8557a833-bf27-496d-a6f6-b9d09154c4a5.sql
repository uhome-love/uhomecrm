
-- Elegibilidade da Roleta de Domingo
CREATE OR REPLACE FUNCTION public.elegivel_roleta_domingo(
  p_corretor_id uuid,
  p_domingo date
)
RETURNS TABLE(elegivel boolean, presencas_semana int, visitas_semana int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seg date := p_domingo - INTERVAL '6 days';
  v_sab date := p_domingo - INTERVAL '1 day';
  v_pres int;
  v_vis int;
  v_corretor_user uuid;
BEGIN
  -- Presenças válidas: 'na_empresa' em manhã/tarde de segunda a sábado
  SELECT COUNT(DISTINCT (data, turno))::int
    INTO v_pres
    FROM public.roleta_presencas
   WHERE corretor_id = p_corretor_id
     AND data BETWEEN v_seg AND v_sab
     AND turno IN ('manha','tarde')
     AND status = 'na_empresa';

  -- Visitas realizadas na semana (visitas.corretor_id = auth.users.id em geral)
  SELECT user_id INTO v_corretor_user FROM public.profiles WHERE id = p_corretor_id;

  SELECT COUNT(*)::int INTO v_vis
    FROM public.visitas
   WHERE (corretor_id = v_corretor_user OR corretor_id = p_corretor_id)
     AND status = 'realizada'
     AND data_visita::date BETWEEN v_seg AND v_sab;

  presencas_semana := COALESCE(v_pres, 0);
  visitas_semana   := COALESCE(v_vis, 0);
  elegivel := presencas_semana >= 4 AND visitas_semana >= 2;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.elegivel_roleta_domingo(uuid, date) TO authenticated, service_role;

-- Fechamento do Sábado: falta automática para quem não credenciou
CREATE OR REPLACE FUNCTION public.registrar_faltas_sabado(p_data date DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data date := COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_count int := 0;
BEGIN
  -- Roda somente se for sábado (dow=6)
  IF EXTRACT(DOW FROM v_data) <> 6 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.roleta_presencas
    (corretor_id, data, turno, status, origem, observacao, validado_em)
  SELECT
    p.id, v_data, 'manha', 'falta', 'sistema_fechamento',
    'Falta automática (Sábado sem credenciamento aprovado)', now()
    FROM public.profiles p
   WHERE p.cargo = 'corretor'
     AND p.ativo = true
     AND NOT EXISTS (
       SELECT 1 FROM public.roleta_credenciamentos c
        WHERE c.corretor_id = p.id
          AND c.data = v_data
          AND c.status = 'aprovado'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.roleta_presencas rp
        WHERE rp.corretor_id = p.id
          AND rp.data = v_data
          AND rp.turno = 'manha'
     )
  ON CONFLICT (corretor_id, data, turno) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_faltas_sabado(date) TO service_role;

-- Cron 23:59 BRT (02:59 UTC) todo sábado (aciona apenas se sábado BRT).
-- Escolhemos 02:59 UTC de domingo, que é 23:59 BRT sábado.
DO $$
BEGIN
  PERFORM cron.unschedule('registrar-faltas-sabado');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'registrar-faltas-sabado',
  '59 2 * * 0',  -- domingo 02:59 UTC = sábado 23:59 BRT
  $$SELECT public.registrar_faltas_sabado((now() AT TIME ZONE 'America/Sao_Paulo')::date)$$
);
