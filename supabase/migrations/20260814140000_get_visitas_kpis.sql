-- FONTE ÚNICA dos KPIs de visita (dashboard CEO + Agenda espelham esta regra).
-- Tabela CRUA `visitas` (tipo=lead) por DATA_VISITA no período. CADA visita conta —
-- NÃO deduplica: um cliente pode visitar 2 empreendimentos no mesmo dia = 2 visitas reais
-- (deduplicar por visitas_unicas subtraía visitas legítimas). Ignora cancelada + backfill_*.
-- Buckets MUTUAMENTE EXCLUSIVOS (por data_visita): total = a_realizar + realizadas + no_show.
-- + 'agendadas' = visitas MARCADAS no período (por created_at) — novos agendamentos.
-- Espelhado em TS por src/lib/visitaKpis.ts (bucketVisitasCanonico) — andam juntas.
-- Escopo: admin/diretor/gestor/rh veem o escopo pedido (null = todos); demais só a si.
-- Já aplicada em produção em 14/08/2026 (v2 crua).

CREATE OR REPLACE FUNCTION public.get_visitas_kpis(p_start date, p_end date, p_corretores uuid[] DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_scope uuid[] := p_corretores;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  -- admin/diretor/rh = escopo pedido (null = todos); gestor com null = só o time dele; demais = só a si.
  IF public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor') OR public.has_role(v_uid,'rh') THEN
    v_scope := p_corretores;
  ELSIF public.has_role(v_uid,'gestor') THEN
    IF p_corretores IS NULL THEN
      v_scope := COALESCE((SELECT array_agg(tm.user_id) FROM team_members tm
                           WHERE tm.gerente_id=v_uid AND tm.status='ativo' AND tm.user_id IS NOT NULL), ARRAY[]::uuid[]) || ARRAY[v_uid];
    ELSE v_scope := p_corretores;
    END IF;
  ELSE
    v_scope := ARRAY[v_uid];
  END IF;
  SELECT jsonb_build_object(
    'total', count(*) FILTER (WHERE t.dvis),
    'a_realizar', count(*) FILTER (WHERE t.dvis AND t.status IN ('marcada','confirmada','reagendada')),
    'realizadas', count(*) FILTER (WHERE t.dvis AND t.status='realizada'),
    'no_show', count(*) FILTER (WHERE t.dvis AND t.status='no_show'),
    'agendadas', count(*) FILTER (WHERE t.dcreated)
  ) INTO v_result
  FROM (
    SELECT v.status,
      (v.data_visita BETWEEN p_start AND p_end) AS dvis,
      ((v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end) AS dcreated
    FROM visitas v
    WHERE (v.data_visita BETWEEN p_start AND p_end
           OR (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end)
      AND v.status <> 'cancelada' AND COALESCE(v.origem,'') NOT LIKE 'backfill_%'
      AND COALESCE(v.tipo,'lead') = 'lead'
      AND (v_scope IS NULL OR v.corretor_id = ANY(v_scope))
  ) t;
  RETURN COALESCE(v_result, jsonb_build_object('total',0,'a_realizar',0,'realizadas',0,'no_show',0,'agendadas',0));
END; $function$;
