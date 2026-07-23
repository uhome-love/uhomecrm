CREATE OR REPLACE FUNCTION public.contar_leads_desatualizados(p_corretor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  WITH scope_ids AS (
    SELECT unnest(public.resolve_corretor_scope_ids(p_corretor_id)) AS id
  )
  SELECT COUNT(*)::INTEGER
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id IN (SELECT id FROM scope_ids)
    AND COALESCE(pl.arquivado, false) = false
    AND COALESCE(ps.tipo, '') NOT IN ('descarte', 'convertido', 'venda', 'caiu')
    AND NOT EXISTS (
      SELECT 1
      FROM public.pipeline_tarefas pt
      WHERE pt.pipeline_lead_id = pl.id
        AND pt.status = 'pendente'
    );
$function$;