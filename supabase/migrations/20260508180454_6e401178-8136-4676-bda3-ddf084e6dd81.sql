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
  v_cutoff timestamptz := NOW() - INTERVAL '48 hours';
BEGIN
  FOR r IN
    SELECT pl.id, pl.corretor_id, pl.nome, pl.empreendimento
    FROM pipeline_leads pl
    WHERE pl.stage_id = sem_contato_stage_id
      AND pl.corretor_id IS NOT NULL
      AND pl.arquivado IS NOT TRUE
      -- 1) Nenhum toque no próprio registro do lead
      AND GREATEST(
        COALESCE(pl.ultima_acao_at, pl.created_at),
        COALESCE(pl.stage_changed_at, pl.created_at),
        COALESCE(pl.updated_at, pl.created_at)
      ) < v_cutoff
      -- 2) Nenhuma tarefa criada/atualizada/concluída nas últimas 48h
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_tarefas t
        WHERE t.pipeline_lead_id = pl.id
          AND GREATEST(
            COALESCE(t.created_at, 'epoch'::timestamptz),
            COALESCE(t.concluida_em, 'epoch'::timestamptz)
          ) >= v_cutoff
      )
      -- 3) Nenhuma atividade registrada nas últimas 48h
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_atividades a
        WHERE a.pipeline_lead_id = pl.id
          AND COALESCE(a.created_at, 'epoch'::timestamptz) >= v_cutoff
      )
      -- 4) Nenhuma anotação criada nas últimas 48h
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_anotacoes an
        WHERE an.pipeline_lead_id = pl.id
          AND COALESCE(an.created_at, 'epoch'::timestamptz) >= v_cutoff
      )
      -- 5) Nenhum registro de histórico nas últimas 48h (exceto a própria reciclagem anterior, que conta)
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_historico h
        WHERE h.pipeline_lead_id = pl.id
          AND COALESCE(h.created_at, 'epoch'::timestamptz) >= v_cutoff
      )
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
      'Redistribuído automaticamente: 48h sem qualquer atividade (tarefa, anotação, histórico) na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido')
    );

    INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao)
    VALUES (
      r.id,
      r.corretor_id,
      'reciclagem_sem_contato',
      'Inatividade total 48h na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido')
    );

    lead_id := r.id;
    corretor_anterior := r.corretor_id;
    lead_nome := r.nome;
    lead_empreendimento := r.empreendimento;
    RETURN NEXT;
  END LOOP;
END;
$function$;