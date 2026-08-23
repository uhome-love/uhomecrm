-- Cockpit do gerente · Fila de Pós-Visita (fonte única, escopo do gerente).
-- Retorna os leads em Pós-Visita da equipe do gerente, ordenados por prioridade:
-- 1) quem "quer proposta", 2) temperatura (muito quente -> frio), 3) mais parado.
-- Mesmo padrão da get_dashboard_gerente_cockpit (SECURITY DEFINER + team_members).
CREATE OR REPLACE FUNCTION public.get_gerente_fila_pos_visita()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'gestor') OR public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH team AS (
    SELECT tm.user_id AS corretor, p.nome
    FROM team_members tm LEFT JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.gerente_id = v_uid AND tm.status = 'ativo' AND tm.user_id IS NOT NULL
  ),
  base AS (
    SELECT pl.id AS lead_id, pl.nome AS cliente, t.nome AS corretor,
      pl.empreendimento, pl.temperatura, pl.proxima_acao, pl.data_proxima_acao, pl.stage_changed_at,
      v.resultado_visita, v.objecao
    FROM pipeline_leads pl
    JOIN team t ON t.corretor = pl.corretor_id
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    LEFT JOIN LATERAL (
      SELECT vr.resultado_visita, vr.objecao
      FROM visitas vr
      WHERE vr.pipeline_lead_id = pl.id AND vr.status = 'realizada'
      ORDER BY vr.data_visita DESC NULLS LAST
      LIMIT 1
    ) v ON true
    WHERE ps.tipo = 'pos_visita' AND pl.arquivado = false
  ),
  ordenado AS (
    SELECT *,
      (data_proxima_acao IS NULL) AS sem_proximo_passo,
      GREATEST(0, ((now() AT TIME ZONE 'America/Sao_Paulo')::date - stage_changed_at::date)) AS dias,
      (CASE resultado_visita WHEN 'gostou_quer_proposta' THEN 0 ELSE 1 END) AS ord_res,
      (CASE temperatura WHEN 'muito_quente' THEN 0 WHEN 'quente' THEN 1 WHEN 'morno' THEN 2 WHEN 'frio' THEN 3 ELSE 4 END) AS ord_temp
    FROM base
    ORDER BY ord_res, ord_temp, dias DESC
    LIMIT 60
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', lead_id, 'cliente', cliente, 'corretor', corretor,
    'empreendimento', empreendimento, 'resultado', resultado_visita,
    'objecao', objecao, 'temperatura', temperatura,
    'proxima_acao', proxima_acao, 'data_proxima_acao', data_proxima_acao,
    'sem_proximo_passo', sem_proximo_passo, 'dias', dias
  ) ORDER BY ord_res, ord_temp, dias DESC), '[]'::jsonb)
  INTO v_result
  FROM ordenado;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_gerente_fila_pos_visita() TO authenticated;
