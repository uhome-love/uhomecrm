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
  -- Notifica APENAS leads que estão DESATUALIZADOS (sem qualquer edição há 7+ dias).
  -- "Parado na etapa" não é mais critério — só importa se o corretor não mexeu no lead.
  FOR v_lead IN
    SELECT pl.id, pl.nome, pl.corretor_id, pl.stage_id,
           ps.nome as stage_nome,
           EXTRACT(EPOCH FROM (now() - pl.updated_at)) / 86400 as dias_sem_atualizar
    FROM pipeline_leads pl
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    WHERE ps.tipo NOT IN ('venda', 'descarte')
      AND pl.corretor_id IS NOT NULL
      AND pl.arquivado = false
      AND pl.aceite_status = 'aceito'
      AND pl.updated_at < now() - interval '7 days'
      AND (pl.last_escalation_at IS NULL OR pl.last_escalation_at < now() - interval '7 days')
  LOOP
    PERFORM criar_notificacao(
      v_lead.corretor_id, 'alertas', 'lead_desatualizado',
      '⚠️ ' || COALESCE(v_lead.nome, 'Lead') || ' está sem atualização',
      'Você não atualiza este lead há ' || round(v_lead.dias_sem_atualizar) || ' dias. Registre um contato, tarefa ou mude a etapa.',
      jsonb_build_object('lead_id', v_lead.id, 'pipeline_lead_id', v_lead.id, 'lead_nome', v_lead.nome, 'etapa', v_lead.stage_nome, 'dias_sem_atualizar', round(v_lead.dias_sem_atualizar)),
      'lead_desatualizado_' || v_lead.id::text
    );

    UPDATE pipeline_leads
       SET last_escalation_at = now(),
           escalation_level = COALESCE(escalation_level, 0) + 1
     WHERE id = v_lead.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;