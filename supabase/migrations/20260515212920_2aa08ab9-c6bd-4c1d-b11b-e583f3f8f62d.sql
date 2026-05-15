CREATE OR REPLACE FUNCTION public.contar_leads_desatualizados(p_corretor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM pipeline_leads pl
  WHERE pl.corretor_id = p_corretor_id
    AND (pl.arquivado IS NULL OR pl.arquivado = false)
    AND pl.stage_id != '1dd66c25-3848-4053-9f66-82e902989b4d'
    AND NOT EXISTS (
      SELECT 1
      FROM pipeline_tarefas pt
      WHERE pt.pipeline_lead_id = pl.id
        AND pt.status = 'pendente'
    );
$function$;