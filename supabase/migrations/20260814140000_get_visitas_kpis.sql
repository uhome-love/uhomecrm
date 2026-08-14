-- FONTE ÚNICA dos KPIs de visita (dashboard CEO + Agenda espelham esta regra).
-- Tabela CRUA `visitas` (tipo=lead) por DATA_VISITA no período. CADA visita conta —
-- NÃO deduplica: um cliente pode visitar 2 empreendimentos no mesmo dia = 2 visitas reais
-- (deduplicar por visitas_unicas subtraía visitas legítimas). Ignora cancelada + backfill_*.
-- Buckets MUTUAMENTE EXCLUSIVOS: total = a_realizar + realizadas + no_show.
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
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor') OR public.has_role(v_uid,'gestor') OR public.has_role(v_uid,'rh')) THEN
    v_scope := ARRAY[v_uid];
  END IF;
  SELECT jsonb_build_object(
    'total', count(*),
    'a_realizar', count(*) FILTER (WHERE v.status IN ('marcada','confirmada','reagendada')),
    'realizadas', count(*) FILTER (WHERE v.status='realizada'),
    'no_show', count(*) FILTER (WHERE v.status='no_show')
  ) INTO v_result
  FROM visitas v
  WHERE v.data_visita BETWEEN p_start AND p_end
    AND v.status <> 'cancelada' AND COALESCE(v.origem,'') NOT LIKE 'backfill_%'
    AND COALESCE(v.tipo,'lead') = 'lead'
    AND (v_scope IS NULL OR v.corretor_id = ANY(v_scope));
  RETURN COALESCE(v_result, jsonb_build_object('total',0,'a_realizar',0,'realizadas',0,'no_show',0));
END; $function$;
