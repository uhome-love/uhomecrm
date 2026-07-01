CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_avancar_acao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Regra definitiva: atividades humanas NÃO avançam tentativa.
  -- Tentativa Sem Contato passa a ser derivada exclusivamente de tarefas concluídas.
  -- Mantemos este gatilho apenas para limpar aviso de estagnação quando houver ação humana.
  IF NEW.tipo IS NULL OR NEW.tipo NOT IN (
      'ligacao','whatsapp','contato','nota','mensagem','email',
      'retorno','nao_atendeu','followup','reuniao','visita','envio_material'
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.pipeline_leads
     SET estagnado_aviso_em = NULL,
         estagnado_prazo_em = NULL,
         updated_at = now()
   WHERE id = NEW.pipeline_lead_id
     AND (estagnado_aviso_em IS NOT NULL OR estagnado_prazo_em IS NOT NULL);

  RETURN NEW;
END;
$function$;

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
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO c
    FROM public.lead_cadencia_sem_contato
   WHERE pipeline_lead_id = p_lead_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_lead
    FROM public.pipeline_leads
   WHERE id = p_lead_id;

  IF NOT FOUND OR v_lead.stage_id IS DISTINCT FROM sem_contato OR v_lead.arquivado IS TRUE THEN
    RETURN;
  END IF;

  SELECT LEAST(7, count(*)::int) INTO v_real
    FROM public.pipeline_tarefas t
   WHERE t.pipeline_lead_id = p_lead_id
     AND t.status = 'concluida'
     AND t.created_at >= c.iniciada_em - interval '5 minutes';

  v_old := COALESCE(c.tentativa_atual, 0);

  IF v_real < 7 THEN
    v_new_status := 'ativa';
    SELECT espera_minutos INTO v_wait_next
      FROM public.cadencia_sem_contato_passos
     WHERE numero = v_real + 1;

    SELECT MIN((t.vence_em + COALESCE(t.hora_vencimento, time '23:59')) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_new_prox
      FROM public.pipeline_tarefas t
     WHERE t.pipeline_lead_id = p_lead_id
       AND t.status NOT IN ('concluida','cancelada')
       AND t.created_at >= c.iniciada_em - interval '5 minutes';

    IF v_new_prox IS NULL THEN
      v_new_prox := now() + (COALESCE(v_wait_next, 0) || ' minutes')::interval;
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

  -- Se houve ação/tarefa concluída, limpa qualquer aviso antigo de estagnação.
  IF v_real > v_old THEN
    UPDATE public.pipeline_leads
       SET estagnado_aviso_em = NULL,
           estagnado_prazo_em = NULL,
           updated_at = now()
     WHERE id = p_lead_id
       AND (estagnado_aviso_em IS NOT NULL OR estagnado_prazo_em IS NOT NULL);
  END IF;

  -- Remove somente históricos automáticos de cadência acima do número real.
  DELETE FROM public.pipeline_historico h
   WHERE h.pipeline_lead_id = p_lead_id
     AND h.stage_anterior_id = sem_contato
     AND h.stage_novo_id = sem_contato
     AND h.observacao ILIKE 'Cadência Sem Contato — Tentativa % concluída:%'
     AND COALESCE((regexp_match(h.observacao, 'Tentativa ([0-9]+)'))[1]::int, 0) > v_real;

  -- Completa históricos automáticos faltantes até a tentativa real.
  FOR n IN 1..v_real LOOP
    SELECT count(*) INTO v_existing_hist
      FROM public.pipeline_historico h
     WHERE h.pipeline_lead_id = p_lead_id
       AND h.stage_anterior_id = sem_contato
       AND h.stage_novo_id = sem_contato
       AND h.observacao ILIKE ('Cadência Sem Contato — Tentativa ' || n || ' concluída:%');

    IF v_existing_hist = 0 THEN
      SELECT * INTO passo FROM public.cadencia_sem_contato_passos WHERE numero = n;
      INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
      VALUES (p_lead_id, sem_contato, sem_contato, COALESCE(v_lead.corretor_id, c.corretor_id),
              'Cadência Sem Contato — Tentativa ' || n || ' concluída: ' || COALESCE(passo.acao,''));
    END IF;
  END LOOP;

  -- Notifica somente avanço novo; não notifica quando é recálculo para baixo ou sem mudança.
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

CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_tarefa_recalcular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid;
BEGIN
  v_lead_id := COALESCE(NEW.pipeline_lead_id, OLD.pipeline_lead_id);
  PERFORM public.fn_cadencia_sc_recalcular_por_tarefas(v_lead_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_cadencia_sc_recalcular_tarefas ON public.pipeline_tarefas;
CREATE TRIGGER trg_cadencia_sc_recalcular_tarefas
AFTER INSERT OR UPDATE OF status, concluida_em OR DELETE
ON public.pipeline_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.fn_cadencia_sc_tarefa_recalcular();