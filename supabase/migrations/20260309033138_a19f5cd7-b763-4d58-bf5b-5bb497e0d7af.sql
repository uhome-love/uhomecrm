CREATE OR REPLACE FUNCTION public.detectar_leads_parados()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_count integer := 0;
BEGIN
  -- Only notify the CORRETOR when a lead is stuck for more than 7 days
  FOR v_lead IN
    SELECT pl.id, pl.nome, pl.corretor_id, pl.stage_id, pl.stage_changed_at, 
           ps.nome as stage_nome,
           EXTRACT(EPOCH FROM (now() - pl.stage_changed_at)) / 60 as minutos_parado
    FROM pipeline_leads pl
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    WHERE ps.tipo NOT IN ('venda', 'descarte')
      AND pl.corretor_id IS NOT NULL
      AND pl.stage_changed_at < now() - interval '7 days'
      AND (pl.last_escalation_at IS NULL OR pl.last_escalation_at < now() - interval '24 hours')
  LOOP
    PERFORM criar_notificacao(
      v_lead.corretor_id, 'alertas', 'lead_parado',
      '⏰ Seu lead precisa de atenção',
      v_lead.nome || ' está na etapa "' || v_lead.stage_nome || '" há ' ||
      round(v_lead.minutos_parado / 1440) || ' dias. Atualize o status!',
      jsonb_build_object('lead_id', v_lead.id),
      'lead_parado_corretor_' || v_lead.id::text
    );

    UPDATE pipeline_leads SET last_escalation_at = now(), escalation_level = escalation_level + 1
    WHERE id = v_lead.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;