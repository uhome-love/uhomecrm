-- 1) Atualizar intervalos da cadência
-- espera_minutos = intervalo a partir da tentativa anterior
UPDATE cadencia_sem_contato_passos SET espera_minutos = 0    WHERE numero = 1; -- imediata
UPDATE cadencia_sem_contato_passos SET espera_minutos = 360  WHERE numero = 2; -- +6h
UPDATE cadencia_sem_contato_passos SET espera_minutos = 360  WHERE numero = 3; -- +6h
UPDATE cadencia_sem_contato_passos SET espera_minutos = 1440 WHERE numero = 4; -- +24h
UPDATE cadencia_sem_contato_passos SET espera_minutos = 1440 WHERE numero = 5; -- +24h
UPDATE cadencia_sem_contato_passos SET espera_minutos = 1440 WHERE numero = 6; -- +24h
UPDATE cadencia_sem_contato_passos SET espera_minutos = 1440 WHERE numero = 7; -- +24h

-- 2) T7 deixa de descartar imediatamente: vira aviso de descarte
UPDATE cadencia_sem_contato_passos
   SET descartar = false,
       acao = 'Aviso de descarte',
       canal = 'whatsapp',
       texto_app = 'Tentativa 7 — Último aviso: sem retorno em 24h o lead {nome} será descartado (reengajável).',
       texto_whatsapp = COALESCE(texto_whatsapp, '')
 WHERE numero = 7;

-- 3) Reescrever a função para suportar o prazo de 24h e o descarte posterior
CREATE OR REPLACE FUNCTION public.processar_cadencia_sem_contato()
 RETURNS TABLE(lead_id uuid, corretor_id uuid, numero integer, acao text, canal text, texto_app text, texto_whatsapp text, lead_nome text, empreendimento text, telefone text, do_descarte boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  r RECORD; passo cadencia_sem_contato_passos%ROWTYPE;
  v_next int; v_wait_next int; v_new_prox timestamptz; v_new_stat text; v_app text; v_wpp text;
BEGIN
  -- A) Descarte efetivo: leads que receberam o aviso (T7) e passaram das 24h de prazo
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
       SET status = 'descartada',
           tentativas_log = tentativas_log || jsonb_build_object('n', 8, 'descartado_em', now()),
           updated_at = now()
     WHERE id = r.cid;

    INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (r.pipeline_lead_id, sem_contato, sem_contato, r.corretor_id,
            'Cadência Sem Contato — Descarte automático após prazo de 24h sem retorno');

    lead_id := r.pipeline_lead_id; corretor_id := r.corretor_id; numero := 8;
    acao := 'Descarte automático'; canal := 'sistema';
    texto_app := 'Lead ' || COALESCE(r.lnome,'') || ' descartado (reengajável) após cadência Sem Contato.';
    texto_whatsapp := ''; lead_nome := r.lnome; empreendimento := r.lemp; telefone := r.ltel;
    do_descarte := true;
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
      -- T7 enviado: abre prazo de 24h antes do descarte
      v_new_prox := now() + interval '1440 minutes'; v_new_stat := 'aguardando_descarte';
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
    RETURN NEXT;
  END LOOP;
END;
$function$;