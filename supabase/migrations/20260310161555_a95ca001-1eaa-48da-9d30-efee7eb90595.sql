
CREATE OR REPLACE FUNCTION public.get_team_visitas(p_date_from text DEFAULT NULL, p_date_to text DEFAULT NULL)
RETURNS TABLE(id uuid, corretor_id uuid, corretor_nome text, nome_cliente text, empreendimento text, data_visita date, hora_visita text, local_visita text, status text, observacoes text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_gerente_id uuid;
BEGIN
  -- First check: is the caller a gerente? (their user_id appears as gerente_id in team_members)
  IF EXISTS (SELECT 1 FROM team_members tm WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo' LIMIT 1) THEN
    v_team_gerente_id := auth.uid();
  ELSE
    -- Caller is a corretor: find their gerente
    SELECT tm.gerente_id INTO v_team_gerente_id
    FROM team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.status = 'ativo'
    LIMIT 1;
  END IF;

  IF v_team_gerente_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    v.id,
    v.corretor_id,
    COALESCE(p.nome, 'Corretor') AS corretor_nome,
    v.nome_cliente,
    v.empreendimento,
    v.data_visita,
    v.hora_visita::text,
    v.local_visita,
    v.status,
    v.observacoes
  FROM visitas v
  JOIN team_members tm ON tm.user_id = v.corretor_id AND tm.status = 'ativo' AND tm.gerente_id = v_team_gerente_id
  LEFT JOIN profiles p ON p.user_id = v.corretor_id
  WHERE v.corretor_id != auth.uid()
    AND (p_date_from IS NULL OR v.data_visita >= p_date_from::date)
    AND (p_date_to IS NULL OR v.data_visita <= p_date_to::date)
  ORDER BY v.data_visita ASC, v.hora_visita ASC NULLS LAST;
END;
$$;
