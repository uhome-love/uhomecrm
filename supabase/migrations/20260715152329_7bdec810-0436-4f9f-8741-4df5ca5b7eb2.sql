-- ============================================================
-- Sem Contato v2 — cadência com criação automática do próximo passo
-- Novos tempos: T1=0, T2=6h, T3=24h, T4=24h, T5=48h, T6=48h, T7=72h
-- Cap 48h para tarefas MANUAIS em Sem Contato (auto-cadência isenta)
-- ============================================================

-- 1) Coluna origem em pipeline_tarefas
ALTER TABLE public.pipeline_tarefas ADD COLUMN IF NOT EXISTS origem text;
CREATE INDEX IF NOT EXISTS idx_pipeline_tarefas_origem
  ON public.pipeline_tarefas(origem) WHERE origem IS NOT NULL;

-- 2) Marcar tarefas antigas da cadência (heurística por descrição)
UPDATE public.pipeline_tarefas
   SET origem = 'cadencia_sem_contato'
 WHERE origem IS NULL
   AND descricao ILIKE 'Cad%ncia Sem Contato%';

-- 3) Novos tempos por passo
UPDATE public.cadencia_sem_contato_passos SET espera_minutos =
  CASE numero
    WHEN 1 THEN 0
    WHEN 2 THEN 360
    WHEN 3 THEN 1440
    WHEN 4 THEN 1440
    WHEN 5 THEN 2880
    WHEN 6 THEN 2880
    WHEN 7 THEN 4320
  END,
  updated_at = now()
WHERE numero BETWEEN 1 AND 7;

-- 4) fn_cadencia_sc_stage: marca origem na tarefa T1
CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_first_wait int;
  v_due timestamptz;
  v_vence date;
  v_hora time;
  v_passo public.cadencia_sem_contato_passos%ROWTYPE;
BEGIN
  IF NEW.stage_id = sem_contato
     AND NEW.corretor_id IS NOT NULL
     AND NEW.arquivado IS NOT TRUE
     AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id OR OLD.corretor_id IS DISTINCT FROM NEW.corretor_id)
  THEN
    SELECT * INTO v_passo FROM public.cadencia_sem_contato_passos WHERE numero = 1;
    v_first_wait := COALESCE(v_passo.espera_minutos, 0);
    v_due := now() + (v_first_wait || ' minutes')::interval;
    v_vence := (v_due AT TIME ZONE 'America/Sao_Paulo')::date;
    v_hora := (v_due AT TIME ZONE 'America/Sao_Paulo')::time(0);

    INSERT INTO public.lead_cadencia_sem_contato
      (pipeline_lead_id, corretor_id, iniciada_em, tentativa_atual, proxima_em, status, tentativas_log)
    VALUES
      (NEW.id, NEW.corretor_id, now(), 0, v_due, 'ativa', '[]'::jsonb)
    ON CONFLICT (pipeline_lead_id) DO UPDATE SET
      corretor_id = NEW.corretor_id,
      iniciada_em = now(),
      tentativa_atual = 0,
      proxima_em = v_due,
      status = 'ativa',
      tentativas_log = '[]'::jsonb,
      updated_at = now();

    IF NOT EXISTS (
      SELECT 1 FROM public.pipeline_tarefas t
       WHERE t.pipeline_lead_id = NEW.id
         AND t.origem = 'cadencia_sem_contato'
         AND t.status NOT IN ('concluida','cancelada')
    ) THEN
      INSERT INTO public.pipeline_tarefas (
        pipeline_lead_id, titulo, descricao, tipo, prioridade, status,
        responsavel_id, vence_em, hora_vencimento, created_by, origem
      ) VALUES (
        NEW.id,
        'Ligar: ' || COALESCE(NULLIF(trim(NEW.nome), ''), 'Lead'),
        'Cadência Sem Contato — Tentativa 1: ' || COALESCE(v_passo.acao, 'Primeiro contato'),
        'ligacao', 'media', 'pendente',
        NEW.corretor_id, v_vence, v_hora, NEW.corretor_id, 'cadencia_sem_contato'
      );
    END IF;
  ELSIF (TG_OP = 'UPDATE')
        AND ( (OLD.stage_id = sem_contato AND NEW.stage_id IS DISTINCT FROM sem_contato) OR (NEW.arquivado IS TRUE) )
  THEN
    UPDATE public.lead_cadencia_sem_contato
       SET status = 'cancelada', proxima_em = NULL, updated_at = now()
     WHERE pipeline_lead_id = NEW.id AND status = 'ativa';
    -- Cancela tarefas de cadência pendentes ao sair da etapa
    UPDATE public.pipeline_tarefas
       SET status = 'cancelada', updated_at = now()
     WHERE pipeline_lead_id = NEW.id
       AND origem = 'cadencia_sem_contato'
       AND status NOT IN ('concluida','cancelada');
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) fn_cadencia_sc_recalcular_por_tarefas: cria automaticamente a próxima tarefa T_{n+1}
CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_recalcular_por_tarefas(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  c public.lead_cadencia_sem_contato%ROWTYPE;
  v_lead public.pipeline_leads%ROWTYPE;
  v_real int := 0;
  v_old int := 0;
  v_new_status text;
  v_new_prox timestamptz;
  v_wait_next int;
  v_existing_hist int := 0;
  n int;
  passo public.cadencia_sem_contato_passos%ROWTYPE;
  prox public.cadencia_sem_contato_passos%ROWTYPE;
  v_titulo text;
  v_msg text;
  v_next_vence date;
  v_next_hora time;
  v_tipo text;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  SELECT * INTO c FROM public.lead_cadencia_sem_contato
   WHERE pipeline_lead_id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id = p_lead_id;
  IF NOT FOUND OR v_lead.stage_id IS DISTINCT FROM sem_contato OR v_lead.arquivado IS TRUE THEN RETURN; END IF;

  -- Conta tarefas da cadência concluídas (contagem confiável por origem)
  SELECT LEAST(7, count(*)::int) INTO v_real
    FROM public.pipeline_tarefas t
   WHERE t.pipeline_lead_id = p_lead_id
     AND t.origem = 'cadencia_sem_contato'
     AND t.status = 'concluida'
     AND t.created_at >= c.iniciada_em - interval '5 minutes';

  -- Fallback: se ainda não temos tarefas com origem marcada, usa contagem antiga
  IF v_real = 0 THEN
    SELECT LEAST(7, count(*)::int) INTO v_real
      FROM public.pipeline_tarefas t
     WHERE t.pipeline_lead_id = p_lead_id
       AND t.status = 'concluida'
       AND t.descricao ILIKE 'Cad%ncia Sem Contato%'
       AND t.created_at >= c.iniciada_em - interval '5 minutes';
  END IF;

  v_old := COALESCE(c.tentativa_atual, 0);

  IF v_real < 7 THEN
    v_new_status := 'ativa';
    SELECT espera_minutos INTO v_wait_next
      FROM public.cadencia_sem_contato_passos WHERE numero = v_real + 1;

    -- CRIAÇÃO AUTOMÁTICA da próxima tarefa da cadência (se não existir pendente)
    IF v_real > v_old AND NOT EXISTS (
      SELECT 1 FROM public.pipeline_tarefas t
       WHERE t.pipeline_lead_id = p_lead_id
         AND t.origem = 'cadencia_sem_contato'
         AND t.status NOT IN ('concluida','cancelada')
    ) THEN
      SELECT * INTO prox FROM public.cadencia_sem_contato_passos WHERE numero = v_real + 1;
      v_new_prox := now() + (COALESCE(v_wait_next, 0) || ' minutes')::interval;
      v_next_vence := (v_new_prox AT TIME ZONE 'America/Sao_Paulo')::date;
      v_next_hora := (v_new_prox AT TIME ZONE 'America/Sao_Paulo')::time(0);
      v_tipo := CASE prox.canal WHEN 'ligacao' THEN 'ligacao' WHEN 'whatsapp' THEN 'whatsapp' ELSE 'contato' END;

      INSERT INTO public.pipeline_tarefas (
        pipeline_lead_id, titulo, descricao, tipo, prioridade, status,
        responsavel_id, vence_em, hora_vencimento, created_by, origem
      ) VALUES (
        p_lead_id,
        COALESCE(prox.acao, 'Contato T' || (v_real + 1)) || ': ' || COALESCE(NULLIF(trim(v_lead.nome), ''), 'Lead'),
        'Cadência Sem Contato — Tentativa ' || (v_real + 1) || ': ' || COALESCE(prox.acao, ''),
        v_tipo, 'media', 'pendente',
        v_lead.corretor_id, v_next_vence, v_next_hora, v_lead.corretor_id, 'cadencia_sem_contato'
      );
    ELSE
      -- Usa vencimento da próxima tarefa aberta, se existir
      SELECT MIN((t.vence_em + COALESCE(t.hora_vencimento, time '23:59')) AT TIME ZONE 'America/Sao_Paulo')
        INTO v_new_prox
        FROM public.pipeline_tarefas t
       WHERE t.pipeline_lead_id = p_lead_id
         AND t.origem = 'cadencia_sem_contato'
         AND t.status NOT IN ('concluida','cancelada');
      IF v_new_prox IS NULL THEN
        v_new_prox := now() + (COALESCE(v_wait_next, 0) || ' minutes')::interval;
      END IF;
    END IF;
  ELSE
    v_new_status := 'aguardando_descarte';
    v_new_prox := COALESCE(c.proxima_em, now() + interval '48 hours');
  END IF;

  UPDATE public.lead_cadencia_sem_contato
     SET tentativa_atual = v_real,
         ultima_acao_em = CASE WHEN v_real > 0 THEN now() ELSE ultima_acao_em END,
         proxima_em = v_new_prox,
         status = v_new_status,
         tentativas_log = CASE
           WHEN v_real <> v_old THEN tentativas_log || jsonb_build_object('n', v_real, 'por_tarefa_concluida', true, 'em', now())
           ELSE tentativas_log
         END,
         updated_at = now()
   WHERE id = c.id;

  IF v_real > v_old THEN
    UPDATE public.pipeline_leads
       SET estagnado_aviso_em = NULL, estagnado_prazo_em = NULL, updated_at = now()
     WHERE id = p_lead_id AND (estagnado_aviso_em IS NOT NULL OR estagnado_prazo_em IS NOT NULL);
  END IF;

  DELETE FROM public.pipeline_historico h
   WHERE h.pipeline_lead_id = p_lead_id
     AND h.stage_anterior_id = sem_contato
     AND h.stage_novo_id = sem_contato
     AND h.observacao ILIKE 'Cadência Sem Contato — Tentativa % concluída:%'
     AND COALESCE((regexp_match(h.observacao, 'Tentativa ([0-9]+)'))[1]::int, 0) > v_real;

  FOR n IN 1..v_real LOOP
    SELECT count(*) INTO v_existing_hist FROM public.pipeline_historico h
     WHERE h.pipeline_lead_id = p_lead_id
       AND h.stage_anterior_id = sem_contato AND h.stage_novo_id = sem_contato
       AND h.observacao ILIKE 'Cadência Sem Contato — Tentativa ' || n || ' concluída:%';
    IF v_existing_hist = 0 THEN
      SELECT * INTO passo FROM public.cadencia_sem_contato_passos WHERE numero = n;
      INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
      VALUES (p_lead_id, sem_contato, sem_contato, v_lead.corretor_id,
        'Cadência Sem Contato — Tentativa ' || n || ' concluída: ' || COALESCE(passo.acao,''));
    END IF;
  END LOOP;

  IF v_real > v_old AND v_lead.corretor_id IS NOT NULL THEN
    IF v_real < 7 THEN
      SELECT * INTO prox FROM public.cadencia_sem_contato_passos WHERE numero = v_real + 1;
      v_titulo := 'Tentativa ' || v_real || ' concluída — próxima: T' || (v_real + 1);
      v_msg := COALESCE(v_lead.nome,'Lead')
               || ' — Próxima ação (Tentativa ' || (v_real + 1) || '): ' || COALESCE(prox.acao,'')
               || '. ' || replace(replace(COALESCE(prox.texto_app,''), '{nome}', COALESCE(v_lead.nome,'o lead')), '{empreendimento}', COALESCE(v_lead.empreendimento,'o empreendimento'));
    ELSE
      v_titulo := 'Despedida enviada (T7) — Sem Contato';
      v_msg := COALESCE(v_lead.nome,'Lead')
               || ' — Última tentativa concluída. Sem retorno em 48h o lead será estagnado e sairá do seu pipeline.';
    END IF;
    INSERT INTO public.notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
    VALUES (v_lead.corretor_id, 'cadencia_sem_contato', 'leads', v_titulo, v_msg,
      ARRAY['corretor'],
      jsonb_build_object('url', '/pipeline?lead=' || p_lead_id, 'lead_id', p_lead_id, 'tentativa', v_real));
  END IF;
END;
$function$;

-- 6) Cap trigger stage-aware: 48h em Sem Contato para tarefas manuais; 30d nas demais
CREATE OR REPLACE FUNCTION public._pipeline_tarefas_cap_30d()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_stage uuid;
  v_due_ts timestamptz;
BEGIN
  IF NEW.vence_em IS NULL OR NEW.concluida_em IS NOT NULL OR COALESCE(NEW.status,'') = 'concluida' THEN
    RETURN NEW;
  END IF;

  -- Auto-cadência é isenta do teto
  IF NEW.origem = 'cadencia_sem_contato' THEN
    RETURN NEW;
  END IF;

  SELECT stage_id INTO v_stage FROM public.pipeline_leads WHERE id = NEW.pipeline_lead_id;

  IF v_stage = sem_contato THEN
    v_due_ts := (NEW.vence_em + COALESCE(NEW.hora_vencimento, time '23:59')) AT TIME ZONE 'America/Sao_Paulo';
    IF v_due_ts > now() + interval '48 hours' THEN
      RAISE EXCEPTION 'Em Sem Contato, tarefas só podem ser agendadas para no máximo 48 horas à frente. Essa etapa tem ritmo diário.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.vence_em > CURRENT_DATE + 30 THEN
      RAISE EXCEPTION 'Tarefas podem ser agendadas para no máximo 30 dias à frente.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7) Backfill: leads em Sem Contato sem tarefa ativa da cadência → cria a do passo atual
DO $backfill$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  r RECORD;
  v_passo public.cadencia_sem_contato_passos%ROWTYPE;
  v_num int;
  v_wait int;
  v_due timestamptz;
  v_vence date;
  v_hora time;
  v_tipo text;
BEGIN
  FOR r IN
    SELECT pl.id AS lid, pl.nome, pl.corretor_id,
           COALESCE(c.tentativa_atual, 0) AS tent, c.status AS cad_status
      FROM public.pipeline_leads pl
      LEFT JOIN public.lead_cadencia_sem_contato c ON c.pipeline_lead_id = pl.id
     WHERE pl.stage_id = sem_contato
       AND pl.arquivado IS NOT TRUE
       AND pl.estagnado IS NOT TRUE
       AND pl.corretor_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.pipeline_tarefas t
          WHERE t.pipeline_lead_id = pl.id
            AND t.origem = 'cadencia_sem_contato'
            AND t.status NOT IN ('concluida','cancelada')
       )
       AND (c.status IS NULL OR c.status = 'ativa')
  LOOP
    v_num := LEAST(COALESCE(r.tent, 0) + 1, 7);
    SELECT * INTO v_passo FROM public.cadencia_sem_contato_passos WHERE numero = v_num;
    v_wait := COALESCE(v_passo.espera_minutos, 0);
    -- Vence em MENOS(espera do passo, 48h) para não estourar o teto
    v_due := now() + LEAST(
      (v_wait || ' minutes')::interval,
      interval '48 hours'
    );
    v_vence := (v_due AT TIME ZONE 'America/Sao_Paulo')::date;
    v_hora := (v_due AT TIME ZONE 'America/Sao_Paulo')::time(0);
    v_tipo := CASE v_passo.canal WHEN 'ligacao' THEN 'ligacao' WHEN 'whatsapp' THEN 'whatsapp' ELSE 'contato' END;

    INSERT INTO public.pipeline_tarefas (
      pipeline_lead_id, titulo, descricao, tipo, prioridade, status,
      responsavel_id, vence_em, hora_vencimento, created_by, origem
    ) VALUES (
      r.lid,
      COALESCE(v_passo.acao, 'Contato T' || v_num) || ': ' || COALESCE(NULLIF(trim(r.nome), ''), 'Lead'),
      'Cadência Sem Contato — Tentativa ' || v_num || ': ' || COALESCE(v_passo.acao, '') || ' (backfill)',
      v_tipo, 'media', 'pendente',
      r.corretor_id, v_vence, v_hora, r.corretor_id, 'cadencia_sem_contato'
    );

    -- Se não existe linha em lead_cadencia_sem_contato, cria
    INSERT INTO public.lead_cadencia_sem_contato
      (pipeline_lead_id, corretor_id, iniciada_em, tentativa_atual, proxima_em, status, tentativas_log)
    VALUES (r.lid, r.corretor_id, now(), r.tent, v_due, 'ativa', '[]'::jsonb)
    ON CONFLICT (pipeline_lead_id) DO UPDATE SET
      proxima_em = v_due, status = 'ativa', updated_at = now();
  END LOOP;
END;
$backfill$;