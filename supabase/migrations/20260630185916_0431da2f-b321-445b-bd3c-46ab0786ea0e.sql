-- ============================================================
-- Etapa "Sem Contato" — regra definitiva
-- 1) Avanço só por contato (trigger) + notificação da próxima tentativa
-- 2) Estagnação por tarefa atrasada (aviso 24h / estagna 48h) + T7 48h
--    SEM avanço por tempo, SEM duplicação de funções
-- ============================================================

-- 1) Trigger de avanço por ação: avança + clava flags de estagnação + notifica a próxima tentativa
CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_avancar_acao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  c lead_cadencia_sem_contato%ROWTYPE;
  passo cadencia_sem_contato_passos%ROWTYPE;
  prox  cadencia_sem_contato_passos%ROWTYPE;
  v_next int; v_wait_next int; v_new_status text; v_new_prox timestamptz;
  v_lead pipeline_leads%ROWTYPE;
  v_titulo text; v_msg text;
BEGIN
  IF NEW.tipo IS NULL OR NEW.tipo NOT IN (
      'ligacao','whatsapp','contato','nota','mensagem','email',
      'retorno','nao_atendeu','followup','reuniao','visita','envio_material'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM lead_cadencia_sem_contato
   WHERE pipeline_lead_id = NEW.pipeline_lead_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND OR c.tentativa_atual >= 7 THEN RETURN NEW; END IF;

  SELECT * INTO v_lead FROM pipeline_leads WHERE id = NEW.pipeline_lead_id;

  v_next := c.tentativa_atual + 1;
  SELECT * INTO passo FROM cadencia_sem_contato_passos WHERE numero = v_next;

  IF v_next < 7 THEN
    SELECT espera_minutos INTO v_wait_next FROM cadencia_sem_contato_passos WHERE numero = v_next + 1;
    v_new_status := 'ativa';
    v_new_prox := now() + (v_wait_next || ' minutes')::interval;
  ELSE
    v_new_status := 'aguardando_descarte';
    v_new_prox := now() + interval '2880 minutes'; -- 48h após o passo 7 (despedida)
  END IF;

  UPDATE lead_cadencia_sem_contato
     SET tentativa_atual = v_next, ultima_acao_em = now(),
         proxima_em = v_new_prox, status = v_new_status,
         tentativas_log = tentativas_log || jsonb_build_object('n', v_next, 'por_acao', true, 'tipo', NEW.tipo, 'em', now()),
         updated_at = now()
   WHERE id = c.id;

  -- Qualquer contato zera o relógio de estagnação por tarefa atrasada
  UPDATE pipeline_leads
     SET estagnado_aviso_em = NULL, estagnado_prazo_em = NULL, updated_at = now()
   WHERE id = NEW.pipeline_lead_id AND (estagnado_aviso_em IS NOT NULL OR estagnado_prazo_em IS NOT NULL);

  -- Histórico da progressão
  INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (NEW.pipeline_lead_id, sem_contato, sem_contato, c.corretor_id,
          'Cadência Sem Contato — Tentativa ' || v_next || ' concluída: ' || COALESCE(passo.acao,''));

  -- Notificação da PRÓXIMA tentativa (sino + push via trg_push_on_notification)
  IF v_lead.corretor_id IS NOT NULL THEN
    IF v_next < 7 THEN
      SELECT * INTO prox FROM cadencia_sem_contato_passos WHERE numero = v_next + 1;
      v_titulo := '✅ Tentativa ' || v_next || ' concluída — próxima: T' || (v_next + 1);
      v_msg := COALESCE(v_lead.nome,'Lead')
               || ' — Próxima ação (Tentativa ' || (v_next + 1) || '): ' || COALESCE(prox.acao,'')
               || '. ' || replace(replace(COALESCE(prox.texto_app,''), '{nome}', COALESCE(v_lead.nome,'o lead')), '{empreendimento}', COALESCE(v_lead.empreendimento,'o empreendimento'));
    ELSE
      v_titulo := '👋 Despedida enviada (T7) — Sem Contato';
      v_msg := COALESCE(v_lead.nome,'Lead')
               || ' — Última tentativa concluída. Sem retorno em 48h o lead será estagnado e sairá do seu pipeline.';
    END IF;

    INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
    VALUES (v_lead.corretor_id, 'cadencia_sem_contato', 'leads', v_titulo, v_msg,
      ARRAY['corretor'],
      jsonb_build_object('url', '/pipeline?lead=' || NEW.pipeline_lead_id, 'lead_id', NEW.pipeline_lead_id, 'tentativa', v_next));
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Função CRON: remove avanço por tempo; adiciona aviso 24h / estagnação 48h por tarefa atrasada + T7
DROP FUNCTION IF EXISTS public.processar_cadencia_sem_contato();

CREATE OR REPLACE FUNCTION public.processar_cadencia_sem_contato()
 RETURNS TABLE(lead_id uuid, corretor_id uuid, tipo text, acao text, texto_app text, texto_whatsapp text, lead_nome text, empreendimento text, telefone text, proxima_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  r RECORD; v_gerente uuid; v_due timestamptz; v_tem_contato boolean;
BEGIN
  -- (A) T7: despedida enviada e passaram 48h sem retorno → ESTAGNADO (caminho único)
  FOR r IN
    SELECT c.id AS cid, c.pipeline_lead_id AS lid, c.corretor_id AS cor,
           pl.nome AS lnome, pl.empreendimento AS lemp, pl.telefone AS ltel
      FROM lead_cadencia_sem_contato c
      JOIN pipeline_leads pl ON pl.id = c.pipeline_lead_id
     WHERE c.status = 'aguardando_descarte' AND c.proxima_em IS NOT NULL AND c.proxima_em <= now()
       AND c.corretor_id IS NOT NULL AND pl.stage_id = sem_contato AND pl.arquivado IS NOT TRUE
     ORDER BY c.proxima_em LIMIT 200
  LOOP
    PERFORM public.cadencia_sc_descartar_reengajavel(r.lid);
    lead_id := r.lid; corretor_id := r.cor; tipo := 'estagnado';
    acao := 'Estagnado (cadência esgotada)'; texto_app := 'Cadência Sem Contato esgotada sem retorno. Lead movido para a Central de Leads Estagnados.';
    texto_whatsapp := ''; lead_nome := r.lnome; empreendimento := r.lemp; telefone := r.ltel; proxima_em := NULL;
    RETURN NEXT;
  END LOOP;

  -- Reset: leads com aviso ativo mas sem tarefa atrasada elegível → limpa relógio
  UPDATE pipeline_leads pl
     SET estagnado_aviso_em = NULL, estagnado_prazo_em = NULL, updated_at = now()
   WHERE pl.stage_id = sem_contato AND pl.estagnado IS NOT TRUE AND pl.estagnado_aviso_em IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pipeline_tarefas pt
        WHERE pt.pipeline_lead_id = pl.id AND pt.status NOT IN ('concluida','cancelada')
          AND (pt.vence_em + COALESCE(pt.hora_vencimento, time '23:59')) AT TIME ZONE 'America/Sao_Paulo'
              <= now() - interval '24 hours'
     );

  -- (B) Estagnação por TAREFA ATRASADA (só com tarefa vencida)
  FOR r IN
    SELECT pl.id AS lid, pl.corretor_id AS cor, pl.nome AS lnome, pl.empreendimento AS lemp,
           pl.telefone AS ltel, pl.estagnado_aviso_em AS aviso,
           MIN((pt.vence_em + COALESCE(pt.hora_vencimento, time '23:59')) AT TIME ZONE 'America/Sao_Paulo') AS due
      FROM pipeline_leads pl
      JOIN lead_cadencia_sem_contato c ON c.pipeline_lead_id = pl.id AND c.status = 'ativa'
      JOIN pipeline_tarefas pt ON pt.pipeline_lead_id = pl.id AND pt.status NOT IN ('concluida','cancelada')
     WHERE pl.stage_id = sem_contato AND pl.arquivado IS NOT TRUE AND pl.estagnado IS NOT TRUE
       AND pl.corretor_id IS NOT NULL
       AND (pt.vence_em + COALESCE(pt.hora_vencimento, time '23:59')) AT TIME ZONE 'America/Sao_Paulo' <= now() - interval '24 hours'
     GROUP BY pl.id, pl.corretor_id, pl.nome, pl.empreendimento, pl.telefone, pl.estagnado_aviso_em
     ORDER BY due ASC LIMIT 200
  LOOP
    v_due := r.due;
    -- houve algum contato depois do vencimento? (se sim, ignora — cadência já teria avançado)
    SELECT EXISTS (
      SELECT 1 FROM pipeline_atividades pa
       WHERE pa.pipeline_lead_id = r.lid AND pa.created_at > v_due
         AND pa.tipo IN ('ligacao','whatsapp','contato','nota','mensagem','email','retorno','nao_atendeu','followup','reuniao','visita','envio_material')
    ) INTO v_tem_contato;
    IF v_tem_contato THEN CONTINUE; END IF;

    IF v_due <= now() - interval '48 hours' THEN
      -- ESTAGNA
      UPDATE pipeline_leads
         SET estagnado = true, estagnado_em = now(), arquivado = true,
             estagnado_aviso_em = NULL, estagnado_prazo_em = NULL, updated_at = now()
       WHERE id = r.lid;

      UPDATE lead_cadencia_sem_contato SET status = 'concluida', proxima_em = NULL, updated_at = now()
       WHERE pipeline_lead_id = r.lid;

      INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
      VALUES (r.lid, sem_contato, sem_contato, r.cor,
              'Estagnado — tarefa da cadência Sem Contato vencida há mais de 48h sem conclusão. Movido para a Central de Leads Estagnados.');

      INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
      VALUES (r.lid, 'sistema', 'Lead estagnado', 'Tarefa da cadência Sem Contato atrasada há mais de 48h sem conclusão.',
              CURRENT_DATE, 'media', 'concluida', r.cor);

      SELECT gerente_id INTO v_gerente FROM team_members WHERE user_id = r.cor AND status = 'ativo' LIMIT 1;
      INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
      VALUES (COALESCE(v_gerente, r.cor), 'alertas', 'lead_estagnado',
        '🛑 Lead estagnado: ' || COALESCE(r.lnome,'(sem nome)'),
        'Tarefa da cadência Sem Contato atrasada há 48h sem conclusão. Defina o destino na Central de Leads Estagnados.',
        ARRAY['gestor','admin','diretor'], jsonb_build_object('lead_id', r.lid));

      lead_id := r.lid; corretor_id := r.cor; tipo := 'estagnado';
      acao := 'Estagnado (tarefa atrasada 48h)'; texto_app := 'Tarefa atrasada há 48h sem conclusão. Lead movido para a Central de Leads Estagnados.';
      texto_whatsapp := ''; lead_nome := r.lnome; empreendimento := r.lemp; telefone := r.ltel; proxima_em := NULL;
      RETURN NEXT;

    ELSIF r.aviso IS NULL THEN
      -- AVISO 24h (uma vez)
      UPDATE pipeline_leads
         SET estagnado_aviso_em = now(), estagnado_prazo_em = v_due + interval '48 hours', updated_at = now()
       WHERE id = r.lid;

      lead_id := r.lid; corretor_id := r.cor; tipo := 'aviso';
      acao := 'Possível estagnação';
      texto_app := 'A tarefa desta tentativa está atrasada há mais de 24h. Conclua em até 24h ou o lead será estagnado e sairá do seu pipeline.';
      texto_whatsapp := '⏳ Possível estagnação — ' || COALESCE(r.lnome,'Lead') || COALESCE(' (' || r.lemp || ')','') ||
                        '. A tarefa está atrasada há mais de 24h. Conclua em até 24h ou o lead será estagnado.';
      lead_nome := r.lnome; empreendimento := r.lemp; telefone := r.ltel; proxima_em := v_due + interval '48 hours';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;