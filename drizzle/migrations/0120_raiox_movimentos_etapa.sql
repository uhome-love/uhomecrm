CREATE OR REPLACE FUNCTION public.raiox_movimentos_etapa(p_corretor uuid, p_stages uuid[], p_de timestamptz, p_ate timestamptz)
RETURNS TABLE(pipeline_lead_id uuid, stage_novo_id uuid, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF NOT (v_uid = p_corretor
    OR public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor')
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.user_id = p_corretor AND tm.gerente_id = v_uid)) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT h.pipeline_lead_id, h.stage_novo_id, h.created_at
    FROM public.pipeline_historico h
    JOIN public.pipeline_leads l ON l.id = h.pipeline_lead_id
    WHERE l.corretor_id = p_corretor
      AND h.stage_novo_id = ANY(p_stages)
      AND h.created_at >= p_de AND h.created_at < p_ate;
END $$;
REVOKE ALL ON FUNCTION public.raiox_movimentos_etapa(uuid, uuid[], timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raiox_movimentos_etapa(uuid, uuid[], timestamptz, timestamptz) TO authenticated, service_role;