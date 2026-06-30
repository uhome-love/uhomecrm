
-- 1) Passo 7: mensagem de despedida + 48h
UPDATE cadencia_sem_contato_passos
SET acao = 'Mensagem de despedida',
    texto_app = 'Envie uma mensagem de despedida gentil. Sem retorno em 48h, o lead será estagnado e sairá do pipeline (volta no reengajamento).',
    texto_whatsapp = '👋 *Mensagem de despedida* — {nome} ({empreendimento}). Envie um último contato gentil avisando que não conseguimos retorno. Sem resposta em 48h, o lead sai do pipeline (volta no reengajamento).',
    espera_minutos = 2880
WHERE numero = 7;

-- 2) Trigger por ação: ao chegar no passo 7, aguardar 48h (não concluir direto) + registrar histórico
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
  v_next int; v_wait_next int; v_new_status text; v_new_prox timestamptz;
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
         tentativas_log = tentativas_log || jsonb_build_object('n', v_next, 'pulada_por_acao', true, 'tipo', NEW.tipo, 'em', now()),
         updated_at = now()
   WHERE id = c.id;

  -- Registra a progressão da cadência no histórico do lead
  INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (NEW.pipeline_lead_id, sem_contato, sem_contato, c.corretor_id,
          'Cadência Sem Contato — Tentativa ' || v_next || ': ' || COALESCE(passo.acao,''));

  RETURN NEW;
END;
$function$;

-- 3) Cron: 48h no passo 7 + estagnação REAL (arquiva + histórico + notificação) no esgotamento
CREATE OR REPLACE FUNCTION public.processar_cadencia_sem_contato()
 RETURNS TABLE(lead_id uuid, corretor_id uuid, numero integer, acao text, canal text, texto_app text, texto_whatsapp text, lead_nome text, empreendimento text, telefone text, do_descarte boolean, proxima_em timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  r RECORD; passo cadencia_sem_contato_passos%ROWTYPE;
  v_next int; v_wait_next int; v_new_prox timestamptz; v_new_stat text; v_app text; v_wpp text;
  v_gerente uuid;
BEGIN
  -- A) Esgotamento: leads que receberam a despedida (T7) e passaram das 48h → ESTAGNADO de fato
  FOR r IN
    SELECT c.id AS cid, c.pipeline_lead_id, c.corretor_id,
           pl.nome AS lnome, pl.empreendimento AS lemp, pl.telefone AS ltel
      FROM lead_cadencia_sem_contato c
      JOIN pipeline_leads pl ON pl.id = c.pipeline_lead_id
     WHERE c.status = 'aguardando_descarte' AND c.proxima_em IS NOT NULL AND c.proxima_em <= now()
       AND c.corretor_id IS NOT NULL
       AND pl.stage_id = sem_contato AND pl.arquivado IS NOT TRUE
     ORDER BY c.proxima_em LIMIT 200
  LOOP
    UPDATE lead_cadencia_sem_contato
       SET status = 'concluida',
           tentativas_log = tentativas_log || jsonb_build_object('n', 8, 'estagnado_em', now()),
           updated_at = now()
     WHERE id = r.cid;

    -- Estagna e arquiva o lead (sai do pipeline, entra na Central)
    UPDATE pipeline_leads
       SET estagnado = true, estagnado_em = now(), arquivado = true, updated_at = now()
     WHERE id = r.pipeline_lead_id;

    INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (r.pipeline_lead_id, sem_contato, sem_contato, r.corretor_id,
            'Estagnado — cadência Sem Contato esgotada (sem retorno após a despedida).');

    INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
    VALUES (r.pipeline_lead_id, 'sistema', 'Lead estagnado', 'Cadência Sem Contato esgotada — movido para a Central de Leads Estagnados.',
            CURRENT_DATE, 'media', 'concluida', r.corretor_id);

    SELECT gerente_id INTO v_gerente FROM team_members WHERE user_id = r.corretor_id AND status = 'ativo' LIMIT 1;
    INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
    VALUES (COALESCE(v_gerente, r.corretor_id), 'alertas', 'lead_estagnado',
      '🛑 Lead estagnado: ' || COALESCE(r.lnome,'(sem nome)'),
      'Cadência Sem Contato esgotada sem retorno. Defina o destino na Central de Leads Estagnados.',
      ARRAY['gestor','admin','diretor'], jsonb_build_object('lead_id', r.pipeline_lead_id));

    lead_id := r.pipeline_lead_id; corretor_id := r.corretor_id; numero := 8;
    acao := 'Estagnado (cadência esgotada)'; canal := 'sistema';
    texto_app := 'Lead ' || COALESCE(r.lnome,'') || ' marcado como estagnado após a cadência Sem Contato. Veja na Central de Leads Estagnados.';
    texto_whatsapp := ''; lead_nome := r.lnome; empreendimento := r.lemp; telefone := r.ltel;
    do_descarte := true; proxima_em := NULL;
    RETURN NEXT;
  END LOOP;

  -- B) Avanço normal das tentativas 1..7
  FOR r IN
    SELECT c.id AS cid, c.pipeline_lead_id, c.corretor_id, c.tentativa_atual,
           pl.nome AS lnome, pl.empreendimento AS lemp, pl.telefone AS ltel
      FROM lead_cadencia_sem_contato c
      JOIN pipeline_leads pl ON pl.id = c.pipeline_lead_id
     WHERE c.status = 'ativa' AND c.proxima_em IS NOT NULL AND c.proxima_em <= now()
       AND c.tentativa_atual < 7 AND c.corretor_id IS NOT NULL
       AND pl.stage_id = sem_contato AND pl.arquivado IS NOT TRUE
     ORDER BY c.proxima_em LIMIT 200
  LOOP
    v_next := r.tentativa_atual + 1;
    SELECT * INTO passo FROM cadencia_sem_contato_passos WHERE numero = v_next;

    IF v_next < 7 THEN
      SELECT espera_minutos INTO v_wait_next FROM cadencia_sem_contato_passos WHERE numero = v_next + 1;
      v_new_prox := now() + (v_wait_next || ' minutes')::interval; v_new_stat := 'ativa';
    ELSE
      v_new_prox := now() + interval '2880 minutes'; v_new_stat := 'aguardando_descarte'; -- 48h
    END IF;

    UPDATE lead_cadencia_sem_contato
       SET tentativa_atual = v_next, proxima_em = v_new_prox, status = v_new_stat,
           tentativas_log = tentativas_log || jsonb_build_object('n', v_next, 'enviada_em', now()),
           updated_at = now()
     WHERE id = r.cid;

    INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (r.pipeline_lead_id, sem_contato, sem_contato, r.corretor_id,
            'Cadência Sem Contato — Tentativa ' || v_next || ': ' || passo.acao);

    INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
    VALUES (r.pipeline_lead_id, 'sistema', 'Cadência: Tentativa ' || v_next, passo.acao,
            CURRENT_DATE, 'media', 'concluida', r.corretor_id);

    v_app := replace(replace(passo.texto_app, '{nome}', COALESCE(r.lnome,'Lead')), '{empreendimento}', COALESCE(r.lemp,'N/A'));
    v_wpp := replace(replace(passo.texto_whatsapp, '{nome}', COALESCE(r.lnome,'Lead')), '{empreendimento}', COALESCE(r.lemp,'N/A'));

    lead_id := r.pipeline_lead_id; corretor_id := r.corretor_id; numero := v_next;
    acao := passo.acao; canal := passo.canal; texto_app := v_app; texto_whatsapp := v_wpp;
    lead_nome := r.lnome; empreendimento := r.lemp; telefone := r.ltel; do_descarte := false;
    proxima_em := v_new_prox;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 4) Correção de dados: leads com cadência concluída mas ainda no pipeline → estagnar + histórico
INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
SELECT pl.id, pl.stage_id, pl.stage_id, pl.corretor_id,
       'Estagnado — cadência Sem Contato esgotada (correção de fluxo).'
  FROM pipeline_leads pl
  JOIN lead_cadencia_sem_contato c ON c.pipeline_lead_id = pl.id
 WHERE c.status = 'concluida'
   AND pl.stage_id = '2fcba9be-1188-4a54-9452-394beefdc330'
   AND pl.arquivado IS NOT TRUE
   AND pl.estagnado IS NOT TRUE
   AND pl.negocio_id IS NULL;

UPDATE pipeline_leads pl
   SET estagnado = true, estagnado_em = now(), arquivado = true, updated_at = now()
  FROM lead_cadencia_sem_contato c
 WHERE c.pipeline_lead_id = pl.id
   AND c.status = 'concluida'
   AND pl.stage_id = '2fcba9be-1188-4a54-9452-394beefdc330'
   AND pl.arquivado IS NOT TRUE
   AND pl.estagnado IS NOT TRUE
   AND pl.negocio_id IS NULL;
