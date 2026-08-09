CREATE OR REPLACE FUNCTION public.get_relatorio_funil(
  p_gestor_id uuid,
  p_start date,
  p_end date,
  p_prev_start date DEFAULT NULL,
  p_prev_end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[];
  v_periodo jsonb; v_coorte jsonb; v_coorte_prev jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_gestor_id IS NULL THEN
    IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
  END IF;

  WITH stage_rank AS (
    SELECT id, CASE tipo
      WHEN 'novo_lead' THEN 1 WHEN 'sem_contato' THEN 1
      WHEN 'qualificacao' THEN 2 WHEN 'aquecimento' THEN 2
      WHEN 'visita' THEN 4 WHEN 'pos_visita' THEN 5
      WHEN 'proposta' THEN 6 WHEN 'contrato_gerado' THEN 7
      WHEN 'venda' THEN 8 ELSE 0 END AS rnk
    FROM pipeline_stages WHERE pipeline_tipo='leads'
  ),
  base AS (
    SELECT pl.id, pl.stage_id,
      (COALESCE(pl.aceito_em, pl.distribuido_em, pl.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS receb_date
    FROM pipeline_leads pl
    WHERE pl.corretor_id = ANY(v_team_auth) AND COALESCE(pl.arquivado,false)=false
  ),
  maxr AS (
    SELECT b.receb_date,
      GREATEST(
        COALESCE((SELECT MAX(sr.rnk) FROM pipeline_historico h JOIN stage_rank sr ON sr.id=h.stage_novo_id WHERE h.pipeline_lead_id=b.id),0),
        COALESCE((SELECT sr2.rnk FROM stage_rank sr2 WHERE sr2.id=b.stage_id),0)
      ) AS mr
    FROM base b
  )
  SELECT
    jsonb_build_object(
      'leads', count(*),
      'atendimento', count(*) FILTER (WHERE mr>=2),
      'visita', count(*) FILTER (WHERE mr>=4),
      'pos_visita', count(*) FILTER (WHERE mr>=5),
      'em_negociacao', count(*) FILTER (WHERE mr>=6),
      'venda', count(*) FILTER (WHERE mr>=8)
    ),
    jsonb_build_object(
      'leads', count(*) FILTER (WHERE receb_date BETWEEN p_start AND p_end),
      'atendimento', count(*) FILTER (WHERE mr>=2 AND receb_date BETWEEN p_start AND p_end),
      'visita', count(*) FILTER (WHERE mr>=4 AND receb_date BETWEEN p_start AND p_end),
      'pos_visita', count(*) FILTER (WHERE mr>=5 AND receb_date BETWEEN p_start AND p_end),
      'em_negociacao', count(*) FILTER (WHERE mr>=6 AND receb_date BETWEEN p_start AND p_end),
      'venda', count(*) FILTER (WHERE mr>=8 AND receb_date BETWEEN p_start AND p_end)
    ),
    CASE WHEN p_prev_start IS NOT NULL THEN jsonb_build_object(
      'leads', count(*) FILTER (WHERE receb_date BETWEEN p_prev_start AND p_prev_end),
      'atendimento', count(*) FILTER (WHERE mr>=2 AND receb_date BETWEEN p_prev_start AND p_prev_end),
      'visita', count(*) FILTER (WHERE mr>=4 AND receb_date BETWEEN p_prev_start AND p_prev_end),
      'pos_visita', count(*) FILTER (WHERE mr>=5 AND receb_date BETWEEN p_prev_start AND p_prev_end),
      'em_negociacao', count(*) FILTER (WHERE mr>=6 AND receb_date BETWEEN p_prev_start AND p_prev_end),
      'venda', count(*) FILTER (WHERE mr>=8 AND receb_date BETWEEN p_prev_start AND p_prev_end)
    ) ELSE NULL END
  INTO v_periodo, v_coorte, v_coorte_prev
  FROM maxr;

  RETURN jsonb_build_object(
    'periodo_todo', v_periodo,
    'coorte', v_coorte,
    'coorte_prev', v_coorte_prev,
    'meta', jsonb_build_object('start', p_start, 'end', p_end)
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.get_relatorio_funil(uuid,date,date,date,date) TO authenticated;