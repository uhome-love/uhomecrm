-- FASE 1: Correção de 3 RPCs/cron quebrados que estão poluindo logs e quebrando regras de negócio.

-- ============================================================
-- 1) reciclar_leads_sem_contato: incluir stage_novo_id (NOT NULL) no INSERT
-- ============================================================
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
        corretor_anterior_id = r.corretor_id,
        is_redistribuicao = true,
        motivo_redistribuicao = '72h sem contato na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'desconhecido'),
        aceite_status = 'pendente_distribuicao',
        aceito_em = NULL,
        ultima_acao_at = NOW(),
        updated_at = NOW()
    WHERE id = r.id;

    -- FIX: incluir stage_anterior_id, stage_novo_id (NOT NULL) e movido_por (NOT NULL)
    -- Lead permanece na etapa "Sem Contato" — só muda o dono.
    INSERT INTO pipeline_historico (
      pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao, created_at
    )
    VALUES (
      r.id,
      sem_contato_stage_id,
      sem_contato_stage_id,
      r.corretor_id,
      'Liberado para fila CEO (redistribuição): 72h sem qualquer atividade operacional válida (tarefa/anotação/histórico/WhatsApp) na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'desconhecido') || '. Aguarda confirmação do CEO.',
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

-- ============================================================
-- 2) avisar_leads_sem_contato_iminente: aliasar whatsapp_mensagens
--    para eliminar colisão entre OUT param "lead_id" e coluna lead_id.
--    OUT params preservados (consumer lead-escalation lê a.lead_id).
-- ============================================================
CREATE OR REPLACE FUNCTION public.avisar_leads_sem_contato_iminente()
 RETURNS TABLE(lead_id uuid, corretor_id uuid, lead_nome text, lead_empreendimento text, horas_restantes integer)
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
    -- FIX: aliasar whatsapp_mensagens com wm.* para evitar colisão com OUT param lead_id
    SELECT GREATEST(
      r.base_activity,
      COALESCE((SELECT MAX(COALESCE(wm.timestamp, wm.created_at)) FROM whatsapp_mensagens wm WHERE wm.lead_id = r.id AND wm.direction='out'), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(pa.created_at) FROM pipeline_atividades pa WHERE pa.pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(pn.created_at) FROM pipeline_anotacoes pn WHERE pn.pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(ph.created_at) FROM pipeline_historico ph WHERE ph.pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(GREATEST(COALESCE(pt.created_at,'epoch'::timestamptz), COALESCE(pt.concluida_em,'epoch'::timestamptz))) FROM pipeline_tarefas pt WHERE pt.pipeline_lead_id = r.id), 'epoch'::timestamptz)
    ) INTO v_last_activity;

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

-- ============================================================
-- 3) auto_arquivar_descartes_24h: usar schema real de pipeline_historico
--    e substituir data_entrada_etapa (não existe) por stage_changed_at.
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_arquivar_descartes_24h()
 RETURNS TABLE(arquivados_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_descarte_stage_id uuid;
  v_count integer := 0;
  v_lead record;
  v_system_uuid uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT id INTO v_descarte_stage_id
  FROM pipeline_stages
  WHERE nome ILIKE 'Descarte'
  LIMIT 1;

  IF v_descarte_stage_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  FOR v_lead IN
    SELECT id, corretor_id
    FROM pipeline_leads
    WHERE stage_id = v_descarte_stage_id
      AND (arquivado IS NULL OR arquivado = false)
      AND COALESCE(motivo_descarte, '') NOT ILIKE 'Inativado:%'
      AND COALESCE(stage_changed_at, created_at) < (now() - interval '24 hours')
  LOOP
    UPDATE pipeline_leads
    SET arquivado = true,
        updated_at = now()
    WHERE id = v_lead.id;

    -- FIX: schema real de pipeline_historico (pipeline_lead_id, stage_*, movido_por NOT NULL, observacao)
    INSERT INTO pipeline_historico (
      pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao, created_at
    )
    VALUES (
      v_lead.id,
      v_descarte_stage_id,
      v_descarte_stage_id,
      COALESCE(v_lead.corretor_id, v_system_uuid),
      'Lead arquivado automaticamente após 24h em Descarte (segue disponível para nutrição e oferta ativa)',
      now()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$function$;