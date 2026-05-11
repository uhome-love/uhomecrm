
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS is_redistribuicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_redistribuicao text,
  ADD COLUMN IF NOT EXISTS corretor_anterior_id uuid;

CREATE INDEX IF NOT EXISTS idx_pl_redistribuicao ON public.pipeline_leads (is_redistribuicao) WHERE is_redistribuicao = true;

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
        aceite_at = NULL,
        ultima_acao_at = NOW(),
        updated_at = NOW()
    WHERE id = r.id;

    INSERT INTO pipeline_historico (pipeline_lead_id, observacao, movido_por, created_at)
    VALUES (
      r.id,
      'Liberado para fila CEO (redistribuição): 72h sem qualquer atividade operacional válida (tarefa/anotação/histórico/WhatsApp) na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'desconhecido') || '. Aguarda confirmação do CEO.',
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
