CREATE OR REPLACE FUNCTION public._oa_cliente_pipeline(p_tel text, p_email text, p_excluir uuid)
RETURNS TABLE(id uuid, corretor_id uuid, ativo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pl.id, pl.corretor_id,
         (COALESCE(pl.arquivado,false) = false AND pl.aceite_status <> 'descartado' AND COALESCE(s.tipo::text,'') <> 'descarte') AS ativo
  FROM public.pipeline_leads pl
  LEFT JOIN public.pipeline_stages s ON s.id = pl.stage_id
  WHERE (p_excluir IS NULL OR pl.id <> p_excluir)
    AND ((p_tel IS NOT NULL AND pl.telefone_normalizado = p_tel) OR (p_email IS NOT NULL AND lower(pl.email) = p_email))
  ORDER BY 3 DESC, (pl.aceite_status <> 'descartado') DESC, pl.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public._oa_nome_curto(p_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT btrim(split_part(nome,' ',1) || ' ' || COALESCE(left(NULLIF(split_part(nome,' ',2),''),1) || '.',''))
                   FROM public.profiles WHERE user_id = p_uid LIMIT 1), 'outro corretor')
$$;

CREATE OR REPLACE FUNCTION public._oa_reativar_lead(p_pl_id uuid, p_uid uuid, p_descricao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_g uuid; v_stage uuid;
BEGIN
  SELECT gerente_id INTO v_g FROM public.team_members WHERE user_id = p_uid AND status = 'ativo' LIMIT 1;
  SELECT id INTO v_stage FROM public.pipeline_stages WHERE ativo AND nome = 'Novo Lead' LIMIT 1;
  UPDATE public.pipeline_leads SET arquivado = false, aceite_status = 'aceito', corretor_id = p_uid,
    gerente_id = COALESCE(v_g, gerente_id), motivo_descarte = NULL, tipo_descarte = NULL, reengajamento_status = NULL,
    stage_id = COALESCE(v_stage, stage_id), stage_changed_at = now(), reaproveitado_em = now(),
    estagnado = false, estagnado_em = NULL, estagnado_aviso_em = NULL, estagnado_prazo_em = NULL,
    ultimo_toque_at = now(), updated_at = now()
  WHERE id = p_pl_id;
  INSERT INTO public.pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, status, created_by, responsavel_id)
  VALUES (p_pl_id, 'ligacao', 'Lead reaproveitado — Oferta Ativa', p_descricao, 'concluida', p_uid, p_uid);
END $$;

CREATE OR REPLACE FUNCTION public.oa_aproveitar(p_origem text, p_lead_id uuid, p_via text DEFAULT 'ao_vivo')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_oa public.oferta_ativa_leads%ROWTYPE;
  v_res public.bolsao_reservas%ROWTYPE;
  v_pl record; v_dono record;
  v_tel text; v_email text; v_ultima timestamptz;
  v_pl_id uuid; v_stage uuid; v_attempt uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'status','sem_login'); END IF;
  IF p_via NOT IN ('ao_vivo','historico') THEN RETURN jsonb_build_object('ok',false,'status','invalido'); END IF;

  IF p_origem = 'listas' THEN
    IF p_via <> 'historico' THEN RETURN jsonb_build_object('ok',false,'status','invalido'); END IF;
    SELECT max(created_at) INTO v_ultima FROM public.oferta_ativa_tentativas
     WHERE lead_id = p_lead_id AND corretor_id = v_uid AND canal <> 'retorno';
    IF v_ultima IS NULL THEN RETURN jsonb_build_object('ok',false,'status','sem_ligacao'); END IF;
    IF v_ultima < now() - interval '24 hours' THEN RETURN jsonb_build_object('ok',false,'status','fora_prazo'); END IF;

    SELECT * INTO v_oa FROM public.oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','nao_encontrado'); END IF;
    v_tel := public.normalize_telefone(v_oa.telefone);
    v_email := NULLIF(lower(btrim(v_oa.email)),'');
    IF v_tel IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('oa_cliente:' || v_tel, 0)); END IF;
    IF public.contato_bloqueado(v_oa.telefone) THEN RETURN jsonb_build_object('ok',false,'status','bloqueado'); END IF;

    IF v_oa.status = 'aproveitado' AND v_oa.corretor_id IS DISTINCT FROM v_uid THEN
      RETURN jsonb_build_object('ok',false,'status','com_outro','corretor_nome',public._oa_nome_curto(v_oa.corretor_id));
    END IF;
    IF v_oa.em_atendimento_por IS NOT NULL AND v_oa.em_atendimento_por <> v_uid AND v_oa.em_atendimento_ate > now() THEN
      RETURN jsonb_build_object('ok',false,'status','em_ligacao_com_outro');
    END IF;
    IF EXISTS (SELECT 1 FROM public.oferta_ativa_tentativas WHERE lead_id = p_lead_id AND corretor_id <> v_uid AND created_at > v_ultima) THEN
      RETURN jsonb_build_object('ok',false,'status','mexido');
    END IF;

    SELECT * INTO v_dono FROM public._oa_cliente_pipeline(v_tel, v_email, NULL);
    IF v_dono.id IS NOT NULL AND v_dono.ativo THEN
      IF v_dono.corretor_id = v_uid THEN RETURN jsonb_build_object('ok',false,'status','comigo','pipeline_lead_id',v_dono.id); END IF;
      RETURN jsonb_build_object('ok',false,'status','com_outro','corretor_nome',public._oa_nome_curto(v_dono.corretor_id));
    END IF;

    IF v_dono.id IS NOT NULL THEN
      PERFORM public._oa_reativar_lead(v_dono.id, v_uid, 'Aproveitado pelo histórico da Oferta Ativa (cliente retornou)');
      v_pl_id := v_dono.id;
    ELSE
      SELECT id INTO v_stage FROM public.pipeline_stages WHERE ativo AND nome = 'Novo Lead' LIMIT 1;
      INSERT INTO public.pipeline_leads (nome, telefone, email, empreendimento, origem, corretor_id, stage_id, observacoes, aceite_status)
      VALUES (COALESCE(v_oa.nome,'Sem nome'), v_oa.telefone, v_oa.email, v_oa.empreendimento, 'Oferta Ativa', v_uid, v_stage,
              'Lead criado via Oferta Ativa (aproveitado pelo histórico — cliente retornou depois).', 'aceito')
      RETURNING id INTO v_pl_id;
    END IF;

    UPDATE public.oferta_ativa_leads SET status = 'aproveitado', corretor_id = v_uid, interesse_tipo = 'com_interesse',
      em_atendimento_por = NULL, em_atendimento_ate = NULL WHERE id = p_lead_id;
    INSERT INTO public.oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (p_lead_id, v_uid, v_oa.lista_id, v_oa.empreendimento, 'retorno', 'com_interesse', 'Aproveitado pelo histórico (cliente retornou)', 3,
            'retorno:' || p_lead_id || ':' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYYMMDD'))
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_attempt;
    INSERT INTO public.oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('lead_aproveitado_historico', v_uid, p_lead_id, v_oa.lista_id, v_attempt, jsonb_build_object('pipeline_lead_id', v_pl_id));
    RETURN jsonb_build_object('ok',true,'status','aproveitado','pipeline_lead_id',v_pl_id);

  ELSIF p_origem IN ('estagnados','descartados') THEN
    SELECT * INTO v_res FROM public.bolsao_reservas WHERE pipeline_lead_id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','sem_ligacao'); END IF;
    IF v_res.corretor_id IS DISTINCT FROM v_uid THEN
      IF v_res.reservado_ate > now() THEN RETURN jsonb_build_object('ok',false,'status','em_ligacao_com_outro'); END IF;
      RETURN jsonb_build_object('ok',false,'status','mexido');
    END IF;

    SELECT pl.id, pl.corretor_id, pl.telefone, pl.telefone_normalizado, lower(pl.email) AS email, COALESCE(pl.estagnado,false) AS estagnado,
           (COALESCE(pl.arquivado,false) = false AND pl.aceite_status <> 'descartado' AND COALESCE(s.tipo::text,'') <> 'descarte') AS ativo
      INTO v_pl
      FROM public.pipeline_leads pl LEFT JOIN public.pipeline_stages s ON s.id = pl.stage_id
     WHERE pl.id = p_lead_id FOR UPDATE OF pl;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','nao_encontrado'); END IF;

    IF v_res.ultimo_resultado = 'aproveitado' THEN
      IF v_pl.corretor_id = v_uid AND v_pl.ativo THEN RETURN jsonb_build_object('ok',true,'status','aproveitado','pipeline_lead_id',p_lead_id,'idempotent',true); END IF;
      RETURN jsonb_build_object('ok',false,'status','mexido');
    END IF;

    IF p_via = 'ao_vivo' THEN
      IF v_res.reservado_ate IS NULL OR v_res.reservado_ate <= now() THEN
        IF NOT EXISTS (SELECT 1 FROM public.bolsao_elegiveis(v_res.porta) e WHERE e.lead_id = p_lead_id) THEN
          RETURN jsonb_build_object('ok',false,'status','nao_elegivel');
        END IF;
      END IF;
    ELSE
      IF v_res.reservado_ate > now() THEN RETURN jsonb_build_object('ok',false,'status','em_ligacao'); END IF;
      IF v_res.updated_at < now() - interval '24 hours' THEN RETURN jsonb_build_object('ok',false,'status','fora_prazo'); END IF;
      IF COALESCE(v_res.ultimo_resultado,'') NOT IN ('nao_atendeu','sem_interesse') THEN RETURN jsonb_build_object('ok',false,'status','sem_ligacao'); END IF;
    END IF;

    IF v_pl.ativo AND NOT v_pl.estagnado THEN
      IF v_pl.corretor_id = v_uid THEN RETURN jsonb_build_object('ok',false,'status','comigo','pipeline_lead_id',p_lead_id); END IF;
      RETURN jsonb_build_object('ok',false,'status','com_outro','corretor_nome',public._oa_nome_curto(v_pl.corretor_id));
    END IF;

    v_tel := v_pl.telefone_normalizado;
    IF v_tel IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('oa_cliente:' || v_tel, 0)); END IF;
    IF public.contato_bloqueado(v_pl.telefone) THEN RETURN jsonb_build_object('ok',false,'status','bloqueado'); END IF;

    SELECT * INTO v_dono FROM public._oa_cliente_pipeline(v_tel, NULLIF(v_pl.email,''), p_lead_id);
    IF v_dono.id IS NOT NULL AND v_dono.ativo THEN
      IF v_dono.corretor_id = v_uid THEN RETURN jsonb_build_object('ok',false,'status','comigo','pipeline_lead_id',v_dono.id); END IF;
      RETURN jsonb_build_object('ok',false,'status','com_outro','corretor_nome',public._oa_nome_curto(v_dono.corretor_id));
    END IF;

    BEGIN
      PERFORM public._oa_reativar_lead(p_lead_id, v_uid,
        CASE WHEN p_via = 'historico' THEN 'Aproveitado pelo histórico da Oferta Ativa (' || v_res.porta || ')' ELSE 'Aproveitado na Oferta Ativa (' || v_res.porta || ')' END);
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok',false,'status','duplicado');
    END;
    PERFORM set_config('oa.via', p_via, true);
    UPDATE public.bolsao_reservas SET reservado_ate = NULL, ultimo_resultado = 'aproveitado', updated_at = now() WHERE pipeline_lead_id = p_lead_id;
    PERFORM set_config('oa.via', '', true);
    RETURN jsonb_build_object('ok',true,'status','aproveitado','pipeline_lead_id',p_lead_id);
  END IF;
  RETURN jsonb_build_object('ok',false,'status','invalido');
END $$;

CREATE OR REPLACE FUNCTION public.oa_historico_aproveitar(p_lead_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.oa_aproveitar('listas', p_lead_id, 'historico') $$;

CREATE OR REPLACE FUNCTION public._trg_bolsao_conta_oa()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_res text; v_pts int; v_canal text := 'ligacao';
BEGIN
  IF NEW.corretor_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.tentativas > COALESCE(OLD.tentativas,0) THEN
    v_res := CASE WHEN NEW.ultimo_resultado = 'sem_interesse' THEN 'sem_interesse' ELSE 'nao_atendeu' END;
    v_pts := 1;
  ELSIF NEW.ultimo_resultado = 'aproveitado' AND OLD.ultimo_resultado IS DISTINCT FROM 'aproveitado' THEN
    v_res := 'com_interesse'; v_pts := 3;
    IF current_setting('oa.via', true) = 'historico' THEN v_canal := 'retorno'; END IF;
  ELSE
    RETURN NEW;
  END IF;
  BEGIN
    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (NEW.pipeline_lead_id, NEW.corretor_id, v_canal, v_res,
            CASE WHEN v_canal = 'retorno' THEN 'Bolsão (' || COALESCE(NEW.porta,'') || ') — aproveitado pelo histórico' ELSE 'Bolsão (' || COALESCE(NEW.porta,'') || ')' END, v_pts,
            'bolsao:' || NEW.pipeline_lead_id || ':' || v_res || ':' || NEW.tentativas || ':' || extract(epoch from now())::bigint)
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bolsao->oa tentativa falhou: %', SQLERRM;
  END;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.finalizar_tentativa_v2(p_lead_id uuid, p_corretor_id uuid, p_canal text, p_resultado text, p_feedback text, p_lista_id uuid DEFAULT NULL::uuid, p_empreendimento text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_visita_marcada boolean DEFAULT false, p_interesse_tipo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_lista oferta_ativa_listas%ROWTYPE;
  v_existing_attempt uuid;
  v_attempt_id uuid;
  v_pontos integer := 1;
  v_cooldown_intervals integer[] := ARRAY[15, 60, 240, 1440];
  v_cooldown_minutes integer;
  v_team_member record;
  v_checkpoint record;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_total_tentativas int;
  v_total_aproveitados int;
  v_bridge_tel text;
  v_bridge_email text;
  v_bridge_pl_id uuid;
  v_bridge_status text := 'skipped';
  v_bridge_stage_id uuid;
  v_bridge_obs text;
  v_dono record;
BEGIN
  PERFORM public.assert_acts_as(p_corretor_id);
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_attempt FROM oferta_ativa_tentativas WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Tentativa já registrada', 'attempt_id', v_existing_attempt);
    END IF;
  END IF;

  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF p_resultado = 'com_interesse' THEN
    IF v_lead.telefone_normalizado IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM oferta_ativa_leads WHERE telefone_normalizado = v_lead.telefone_normalizado AND status = 'aproveitado' AND id != p_lead_id) THEN
        RETURN jsonb_build_object('success', false, 'reason', 'phone_already_approved');
      END IF;
    END IF;

    IF v_lead.status = 'aproveitado' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'already_approved');
    END IF;

    -- Trava por cliente + checagem de dono (regra única de aproveitamento)
    v_bridge_tel := public.normalize_telefone(v_lead.telefone);
    v_bridge_email := NULLIF(lower(btrim(v_lead.email)), '');
    IF v_bridge_tel IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('oa_cliente:' || v_bridge_tel, 0)); END IF;
    SELECT * INTO v_dono FROM public._oa_cliente_pipeline(v_bridge_tel, v_bridge_email, NULL);
    IF v_dono.id IS NOT NULL AND v_dono.ativo AND v_dono.corretor_id IS DISTINCT FROM p_corretor_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'com_outro', 'corretor_nome', public._oa_nome_curto(v_dono.corretor_id));
    END IF;

    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, 'com_interesse', p_feedback, 3, p_idempotency_key)
    RETURNING id INTO v_attempt_id;

    UPDATE oferta_ativa_leads SET
      status = 'aproveitado', corretor_id = p_corretor_id,
      interesse_tipo = COALESCE(p_interesse_tipo, 'com_interesse'),
      tentativas_count = tentativas_count + 1, ultima_tentativa = now(),
      em_atendimento_por = NULL, em_atendimento_ate = NULL
    WHERE id = p_lead_id;

    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object('resultado','com_interesse','canal',p_canal,'pontos',3,'visita_marcada',p_visita_marcada,'interesse_tipo',p_interesse_tipo));

    -- BRIDGE: dedup por telefone/email alinhado ao índice único parcial
    BEGIN
      v_bridge_tel := public.normalize_telefone(v_lead.telefone);
      v_bridge_email := NULLIF(lower(btrim(v_lead.email)), '');

      IF v_bridge_tel IS NOT NULL THEN
        SELECT id INTO v_bridge_pl_id FROM pipeline_leads
        WHERE telefone_normalizado = v_bridge_tel AND aceite_status <> 'descartado'
        ORDER BY created_at DESC LIMIT 1;
      END IF;

      IF v_bridge_pl_id IS NULL AND v_bridge_email IS NOT NULL THEN
        SELECT id INTO v_bridge_pl_id FROM pipeline_leads
        WHERE lower(email) = v_bridge_email AND aceite_status <> 'descartado'
        ORDER BY created_at DESC LIMIT 1;
      END IF;

      IF v_dono.id IS NOT NULL AND NOT v_dono.ativo THEN
        PERFORM public._oa_reativar_lead(v_dono.id, p_corretor_id, 'Aproveitado na Oferta Ativa (Listas)');
        v_bridge_pl_id := v_dono.id;
        v_bridge_status := 'reactivated';
      ELSIF v_bridge_pl_id IS NOT NULL THEN
        v_bridge_status := 'exists';
      ELSE
        SELECT id INTO v_bridge_stage_id FROM pipeline_stages WHERE ativo=true AND nome='Novo Lead' LIMIT 1;

        v_bridge_obs := format(E'Lead criado via Oferta Ativa (Aproveitado).\nInteresse: %s\nFeedback: %s',
          COALESCE(p_interesse_tipo,'com_interesse'), COALESCE(p_feedback,'(sem feedback)'));

        INSERT INTO pipeline_leads (nome, telefone, email, empreendimento, origem, corretor_id, stage_id, observacoes, aceite_status)
        VALUES (COALESCE(v_lead.nome,'Sem nome'), v_lead.telefone, v_lead.email,
          COALESCE(p_empreendimento, v_lead.empreendimento), 'Oferta Ativa', p_corretor_id,
          v_bridge_stage_id, v_bridge_obs, 'aceito')
        RETURNING id INTO v_bridge_pl_id;

        v_bridge_status := 'created';
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_bridge_status := 'failed';
      v_bridge_pl_id := NULL;
      BEGIN
        INSERT INTO ops_events (fn, level, category, message, ctx)
        VALUES ('finalizar_tentativa_v2','error','bridge_aproveitado',
          COALESCE(NULLIF(SQLERRM,''),'erro desconhecido'),
          jsonb_build_object('attempt_id',v_attempt_id,'oa_lead_id',p_lead_id,'sqlstate',SQLSTATE,'tel',v_bridge_tel));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;

  ELSE
    IF p_resultado = 'numero_errado' THEN v_pontos := 0;
    ELSIF p_resultado = 'sem_interesse' THEN v_pontos := 1;
    ELSIF p_resultado = 'nao_atendeu' THEN v_pontos := 1;
    END IF;

    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, p_resultado, p_feedback, v_pontos, p_idempotency_key)
    RETURNING id INTO v_attempt_id;

    IF p_resultado IN ('numero_errado','sem_interesse') THEN
      UPDATE oferta_ativa_leads SET status='descartado', motivo_descarte=p_resultado, tentativas_count=tentativas_count+1, ultima_tentativa=now(), em_atendimento_por=NULL, em_atendimento_ate=NULL WHERE id=p_lead_id;
      INSERT INTO oa_events (event_type,user_id,lead_id,lista_id,attempt_id,metadata) VALUES ('lead_discarded',p_corretor_id,p_lead_id,COALESCE(p_lista_id,v_lead.lista_id),v_attempt_id,jsonb_build_object('motivo',p_resultado,'canal',p_canal));
    ELSIF p_resultado = 'nao_atendeu' THEN
      SELECT * INTO v_lista FROM oferta_ativa_listas WHERE id=COALESCE(p_lista_id,v_lead.lista_id);
      v_cooldown_minutes := v_cooldown_intervals[LEAST(v_lead.tentativas_count+1, array_length(v_cooldown_intervals,1))];
      IF v_lead.tentativas_count+1 >= COALESCE(v_lista.max_tentativas,3) THEN
        UPDATE oferta_ativa_leads SET status='descartado', motivo_descarte='max_tentativas', tentativas_count=tentativas_count+1, ultima_tentativa=now(), em_atendimento_por=NULL, em_atendimento_ate=NULL WHERE id=p_lead_id;
        INSERT INTO oa_events (event_type,user_id,lead_id,lista_id,attempt_id,metadata) VALUES ('lead_discarded',p_corretor_id,p_lead_id,COALESCE(p_lista_id,v_lead.lista_id),v_attempt_id,jsonb_build_object('motivo','max_tentativas','tentativas',v_lead.tentativas_count+1));
      ELSE
        UPDATE oferta_ativa_leads SET status='em_cooldown', proxima_tentativa_apos=now()+(v_cooldown_minutes||' minutes')::interval, tentativas_count=tentativas_count+1, ultima_tentativa=now(), em_atendimento_por=NULL, em_atendimento_ate=NULL WHERE id=p_lead_id;
      END IF;
    END IF;

    INSERT INTO oa_events (event_type,user_id,lead_id,lista_id,attempt_id,metadata) VALUES ('call_finished',p_corretor_id,p_lead_id,COALESCE(p_lista_id,v_lead.lista_id),v_attempt_id,jsonb_build_object('resultado',p_resultado,'canal',p_canal,'pontos',v_pontos,'visita_marcada',p_visita_marcada));
  END IF;

  SELECT tm.id, tm.gerente_id INTO v_team_member FROM team_members tm WHERE tm.user_id=p_corretor_id AND tm.status='ativo' LIMIT 1;
  IF FOUND THEN
    v_day_start := (v_today::text||'T00:00:00-03:00')::timestamptz;
    v_day_end := (v_today::text||'T23:59:59.999-03:00')::timestamptz;
    SELECT COUNT(*), COUNT(*) FILTER (WHERE resultado='com_interesse') INTO v_total_tentativas, v_total_aproveitados FROM oferta_ativa_tentativas WHERE corretor_id=p_corretor_id AND created_at>=v_day_start AND created_at<=v_day_end;
    SELECT id INTO v_checkpoint FROM checkpoints WHERE gerente_id=v_team_member.gerente_id AND data=v_today;
    IF NOT FOUND THEN INSERT INTO checkpoints (gerente_id, data) VALUES (v_team_member.gerente_id, v_today) RETURNING id INTO v_checkpoint; END IF;
    INSERT INTO checkpoint_lines (checkpoint_id, corretor_id, real_ligacoes, real_leads) VALUES (v_checkpoint.id, v_team_member.id, v_total_tentativas, v_total_aproveitados) ON CONFLICT (checkpoint_id, corretor_id) DO UPDATE SET real_ligacoes=EXCLUDED.real_ligacoes, real_leads=EXCLUDED.real_leads, updated_at=now();
  END IF;

  RETURN jsonb_build_object('success', true, 'resultado', COALESCE(p_resultado,'com_interesse'), 'pontos', COALESCE(v_pontos,3), 'visita_marcada', p_visita_marcada, 'attempt_id', v_attempt_id, 'interesse_tipo', p_interesse_tipo, 'pipeline_status', v_bridge_status, 'pipeline_lead_id', v_bridge_pl_id);
END;
$function$;

REVOKE ALL ON FUNCTION public._oa_cliente_pipeline(text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._oa_nome_curto(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._oa_reativar_lead(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oa_aproveitar(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oa_aproveitar(text,uuid,text) TO authenticated, service_role;