CREATE OR REPLACE FUNCTION public.reciclar_leads_sem_contato()
 RETURNS TABLE(lead_id uuid, corretor_anterior uuid, lead_nome text, lead_empreendimento text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  sem_contato_stage_id uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
BEGIN
  FOR r IN
    SELECT pl.id, pl.corretor_id, pl.nome, pl.empreendimento
    FROM pipeline_leads pl
    WHERE pl.stage_id = sem_contato_stage_id
      AND pl.corretor_id IS NOT NULL
      AND pl.arquivado IS NOT TRUE
      AND GREATEST(
        COALESCE(pl.ultima_acao_at, pl.created_at),
        COALESCE(pl.stage_changed_at, pl.created_at),
        COALESCE(pl.updated_at, pl.created_at)
      ) < NOW() - INTERVAL '48 hours'
  LOOP
    UPDATE pipeline_leads
    SET corretor_id = NULL,
        aceite_status = 'pendente_distribuicao',
        distribuido_em = NULL,
        updated_at = NOW()
    WHERE id = r.id;

    -- FIX: stage_novo_id é NOT NULL; mantém a etapa "Sem Contato"
    INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (
      r.id,
      sem_contato_stage_id,
      sem_contato_stage_id,
      r.corretor_id,
      'Redistribuído automaticamente por inatividade 48h na etapa Sem Contato'
    );

    INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao)
    VALUES (
      r.id,
      r.corretor_id,
      'reciclagem_sem_contato',
      'Inatividade 48h na etapa Sem Contato'
    );

    lead_id := r.id;
    corretor_anterior := r.corretor_id;
    lead_nome := r.nome;
    lead_empreendimento := r.empreendimento;
    RETURN NEXT;
  END LOOP;
END;
$function$;