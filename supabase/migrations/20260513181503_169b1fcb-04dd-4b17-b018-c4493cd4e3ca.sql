-- Expandir exclusão da função detectar_leads_parados (defensivo)
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
      -- Excluir leads com negócio ativo (ganho/em fechamento)
      AND NOT EXISTS (
        SELECT 1 FROM negocios n
        WHERE n.pipeline_lead_id = pl.id
          AND n.status IN ('ativo', 'assinado', 'ganho')
      )
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

-- Trigger: ao mover lead para stage 'venda' OU criar negócio ativo, limpar notificações de "sem atualização"
CREATE OR REPLACE FUNCTION public.cleanup_desatualizado_on_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_stage_tipo text;
BEGIN
  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  IF v_stage_tipo = 'venda' THEN
    DELETE FROM notifications
     WHERE tipo = 'lead_desatualizado'
       AND (dados->>'pipeline_lead_id')::uuid = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_desatualizado_on_venda ON public.pipeline_leads;
CREATE TRIGGER trg_cleanup_desatualizado_on_venda
AFTER UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.cleanup_desatualizado_on_venda();

-- Limpeza única: remover notificações existentes para leads em estágio 'venda' ou com negócio ativo
DELETE FROM notifications
 WHERE tipo = 'lead_desatualizado'
   AND (dados->>'pipeline_lead_id')::uuid IN (
     SELECT pl.id FROM pipeline_leads pl
     JOIN pipeline_stages ps ON ps.id = pl.stage_id
     WHERE ps.tipo = 'venda'
        OR EXISTS (
          SELECT 1 FROM negocios n
          WHERE n.pipeline_lead_id = pl.id
            AND n.status IN ('ativo', 'assinado', 'ganho')
        )
   );