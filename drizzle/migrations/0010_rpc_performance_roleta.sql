CREATE OR REPLACE FUNCTION public.rpc_performance_roleta()
RETURNS TABLE(user_id uuid, nome text, equipe text, gerente_id uuid, crm jsonb, motivo jsonb, visitas_semana_passada integer, visitas_semana_atual integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_all boolean;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_seg date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_all := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor');
  IF NOT v_all AND NOT public.has_role(v_uid,'gestor') THEN RETURN; END IF;
  RETURN QUERY
  SELECT t.user_id, t.nome::text, t.equipe::text, t.gerente_id,
         public.crm_saude_corretor(t.user_id),
         public.roleta_motivo_bloqueio(t.user_id, 'manha'),
         public.roleta_visitas_realizadas_periodo(t.user_id, v_seg - 7, v_seg - 1),
         public.roleta_visitas_realizadas_periodo(t.user_id, v_seg, v_hoje)
  FROM public.team_members t
  WHERE t.status = 'ativo' AND t.user_id IS NOT NULL
    AND (v_all OR t.gerente_id = v_uid);
END $$;
REVOKE ALL ON FUNCTION public.rpc_performance_roleta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_performance_roleta() TO authenticated;