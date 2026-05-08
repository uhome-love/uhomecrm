CREATE OR REPLACE FUNCTION public.reciclar_leads_sem_contato()
 RETURNS TABLE(lead_id uuid, corretor_anterior uuid, lead_nome text, lead_empreendimento text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  sem_contato_stage_id uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_nome_anterior text;
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
    SELECT nome INTO v_nome_anterior FROM profiles WHERE user_id = r.corretor_id;

    UPDATE pipeline_leads
    SET corretor_id = NULL,
        aceite_status = 'pendente_distribuicao',
        distribuido_em = NULL,
        updated_at = NOW()
    WHERE id = r.id;

    INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (
      r.id,
      sem_contato_stage_id,
      sem_contato_stage_id,
      r.corretor_id,
      'Redistribuído automaticamente por inatividade 48h na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido')
    );

    INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao)
    VALUES (
      r.id,
      r.corretor_id,
      'reciclagem_sem_contato',
      'Inatividade 48h na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido')
    );

    lead_id := r.id;
    corretor_anterior := r.corretor_id;
    lead_nome := r.nome;
    lead_empreendimento := r.empreendimento;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reciclar_leads_expirados()
 RETURNS TABLE(lead_id uuid, corretor_anterior uuid, lead_nome text, lead_empreendimento text, lead_telefone text, segmento_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_nome_anterior text;
  v_stage_atual uuid;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.corretor_id, pl.segmento_id AS seg_id, pl.distribuido_em, pl.nome, pl.empreendimento, pl.telefone, pl.stage_id
    FROM pipeline_leads pl
    WHERE pl.aceite_expira_em < (now() - interval '30 seconds')
      AND pl.aceite_status IN ('pendente', 'aguardando_aceite')
      AND pl.corretor_id IS NOT NULL
  LOOP
    SELECT nome INTO v_nome_anterior FROM profiles WHERE user_id = v_lead.corretor_id;

    INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao, motivo_rejeicao, tempo_resposta_seg)
    VALUES (
      v_lead.id,
      v_lead.corretor_id,
      v_lead.seg_id,
      'timeout',
      'tempo_excedido. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido'),
      EXTRACT(EPOCH FROM (now() - v_lead.distribuido_em))::integer
    );

    UPDATE pipeline_leads
    SET corretor_id = NULL,
        distribuido_em = NULL,
        aceite_expira_em = NULL,
        aceite_status = 'pendente_distribuicao',
        updated_at = now()
    WHERE id = v_lead.id
      AND aceite_status IN ('pendente', 'aguardando_aceite');

    IF FOUND THEN
      INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
      VALUES (
        v_lead.id,
        v_lead.stage_id,
        v_lead.stage_id,
        v_lead.corretor_id,
        'Lead expirou sem aceite e será redistribuído. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido')
      );

      lead_id := v_lead.id;
      corretor_anterior := v_lead.corretor_id;
      lead_nome := v_lead.nome;
      lead_empreendimento := v_lead.empreendimento;
      lead_telefone := v_lead.telefone;
      segmento_id := v_lead.seg_id;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;