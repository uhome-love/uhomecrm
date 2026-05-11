
-- Atualiza reciclagem Sem Contato: 72h + WhatsApp out conta como atividade + marca aviso enviado
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
  v_cutoff timestamptz := NOW() - INTERVAL '72 hours';
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
      ) < v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_tarefas t
        WHERE t.pipeline_lead_id = pl.id
          AND (t.status = 'pendente'
            OR GREATEST(COALESCE(t.created_at,'epoch'::timestamptz), COALESCE(t.concluida_em,'epoch'::timestamptz)) >= v_cutoff)
      )
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_atividades a
        WHERE a.pipeline_lead_id = pl.id AND COALESCE(a.created_at,'epoch'::timestamptz) >= v_cutoff
      )
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_anotacoes an
        WHERE an.pipeline_lead_id = pl.id AND COALESCE(an.created_at,'epoch'::timestamptz) >= v_cutoff
      )
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_historico h
        WHERE h.pipeline_lead_id = pl.id AND COALESCE(h.created_at,'epoch'::timestamptz) >= v_cutoff
      )
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_mensagens wm
        WHERE wm.lead_id = pl.id
          AND wm.direction = 'out'
          AND COALESCE(wm.timestamp, wm.created_at) >= v_cutoff
      )
  LOOP
    SELECT nome INTO v_nome_anterior FROM profiles WHERE user_id = r.corretor_id;

    UPDATE pipeline_leads
    SET corretor_id = NULL,
        aceite_status = 'pendente_distribuicao',
        aceite_at = NULL,
        ultima_acao_at = NOW(),
        updated_at = NOW()
    WHERE id = r.id;

    INSERT INTO pipeline_historico (pipeline_lead_id, observacao, movido_por, created_at)
    VALUES (
      r.id,
      'Redistribuído automaticamente: 72h sem qualquer atividade operacional válida (tarefa/anotação/histórico/WhatsApp) na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'desconhecido'),
      r.corretor_id,
      NOW()
    );

    lead_id := r.id;
    corretor_anterior := r.corretor_id;
    lead_nome := r.nome;
    lead_empreendimento := r.empreendimento;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Adiciona coluna de controle de aviso
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS reciclagem_aviso_at timestamptz;

-- Nova RPC: identifica leads próximos do prazo (60h-72h) e marca aviso
CREATE OR REPLACE FUNCTION public.avisar_leads_sem_contato_iminente()
RETURNS TABLE(lead_id uuid, corretor_id uuid, lead_nome text, lead_empreendimento text, horas_restantes int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  sem_contato_stage_id uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_now timestamptz := NOW();
  v_warn_after timestamptz := v_now - INTERVAL '60 hours';
  v_recycle_after timestamptz := v_now - INTERVAL '72 hours';
  v_last_activity timestamptz;
BEGIN
  FOR r IN
    SELECT pl.id, pl.corretor_id AS cid, pl.nome, pl.empreendimento,
      GREATEST(
        COALESCE(pl.ultima_acao_at, pl.created_at),
        COALESCE(pl.stage_changed_at, pl.created_at),
        COALESCE(pl.updated_at, pl.created_at)
      ) AS base_activity
    FROM pipeline_leads pl
    WHERE pl.stage_id = sem_contato_stage_id
      AND pl.corretor_id IS NOT NULL
      AND pl.arquivado IS NOT TRUE
      AND GREATEST(
        COALESCE(pl.ultima_acao_at, pl.created_at),
        COALESCE(pl.stage_changed_at, pl.created_at),
        COALESCE(pl.updated_at, pl.created_at)
      ) <= v_warn_after
      AND GREATEST(
        COALESCE(pl.ultima_acao_at, pl.created_at),
        COALESCE(pl.stage_changed_at, pl.created_at),
        COALESCE(pl.updated_at, pl.created_at)
      ) > v_recycle_after
      AND (pl.reciclagem_aviso_at IS NULL OR pl.reciclagem_aviso_at < pl.stage_changed_at)
  LOOP
    -- Recalcula última atividade considerando WhatsApp/tarefas etc
    SELECT GREATEST(
      r.base_activity,
      COALESCE((SELECT MAX(COALESCE(timestamp, created_at)) FROM whatsapp_mensagens WHERE lead_id = r.id AND direction='out'), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(created_at) FROM pipeline_atividades WHERE pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(created_at) FROM pipeline_anotacoes WHERE pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(created_at) FROM pipeline_historico WHERE pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(GREATEST(COALESCE(created_at,'epoch'::timestamptz), COALESCE(concluida_em,'epoch'::timestamptz))) FROM pipeline_tarefas WHERE pipeline_lead_id = r.id), 'epoch'::timestamptz)
    ) INTO v_last_activity;

    -- Só avisa se realmente está na janela 60h-72h sem nada
    IF v_last_activity <= v_warn_after AND v_last_activity > v_recycle_after THEN
      UPDATE pipeline_leads SET reciclagem_aviso_at = v_now WHERE id = r.id;

      lead_id := r.id;
      corretor_id := r.cid;
      lead_nome := r.nome;
      lead_empreendimento := r.empreendimento;
      horas_restantes := GREATEST(0, EXTRACT(EPOCH FROM (v_last_activity + INTERVAL '72 hours' - v_now))/3600)::int;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;
