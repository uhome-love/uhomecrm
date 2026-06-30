-- 1) Ao confirmar estagnação, arquivar o lead (sai do pipeline do corretor).
--    Ao resetar estagnação (ação/tarefa futura), desarquivar para reaparecer.
CREATE OR REPLACE FUNCTION public.processar_estagnacao_pipeline()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avisos int := 0; v_estagnados int := 0; v_resetados int := 0;
  v_cfg record; v_lead record; v_gerente uuid;
BEGIN
  FOR v_cfg IN SELECT stage_id, dias_limite, limite_backfill_dia FROM pipeline_estagnacao_config WHERE ativo = true LOOP

    -- Reset: lead já estagnado que recebeu ação humana OU tem tarefa pendente futura → sai da estagnação e volta ao pipeline
    UPDATE pipeline_leads pl
      SET estagnado=false, estagnado_em=NULL, estagnado_aviso_em=NULL, estagnado_prazo_em=NULL, arquivado=false, updated_at=now()
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado=true
        AND (
          public._pipeline_ultima_acao_humana(pl.id) > pl.estagnado_em
          OR public._pipeline_tem_tarefa_pendente_futura(pl.id)
        );
    GET DIAGNOSTICS v_resetados = ROW_COUNT;

    -- Reset: lead em aviso que agiu dentro das 48h OU tem tarefa pendente futura → zera contador
    UPDATE pipeline_leads pl
      SET estagnado_aviso_em=NULL, estagnado_prazo_em=NULL, updated_at=now()
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NOT NULL
        AND (
          public._pipeline_ultima_acao_humana(pl.id) > pl.estagnado_aviso_em
          OR public._pipeline_tem_tarefa_pendente_futura(pl.id)
        );

    -- Confirma estagnação: aviso vencido sem ação (e sem tarefa pendente futura) → estagna E arquiva
    FOR v_lead IN
      SELECT pl.id, pl.corretor_id, pl.nome FROM pipeline_leads pl
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em < now()
        AND public._pipeline_ultima_acao_humana(pl.id) <= pl.estagnado_aviso_em
        AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
    LOOP
      UPDATE pipeline_leads SET estagnado=true, estagnado_em=now(), arquivado=true, updated_at=now() WHERE id=v_lead.id;
      SELECT gerente_id INTO v_gerente FROM team_members WHERE user_id=v_lead.corretor_id AND status='ativo' LIMIT 1;
      INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
      VALUES (COALESCE(v_gerente, v_lead.corretor_id), 'alertas', 'lead_estagnado',
        '🛑 Lead estagnado: '||COALESCE(v_lead.nome,'(sem nome)'),
        'Sem ação após o prazo de 48h. Defina o destino na Central de Leads Estagnados.',
        ARRAY['gestor','admin','diretor'], jsonb_build_object('lead_id', v_lead.id));
      v_estagnados := v_estagnados + 1;
    END LOOP;

    -- Novos candidatos → aviso 48h (rampa: limite diário), exceto quem tem tarefa pendente futura
    FOR v_lead IN
      SELECT pl.id, pl.corretor_id, pl.nome FROM pipeline_leads pl
      WHERE pl.stage_id=v_cfg.stage_id AND pl.arquivado IS NOT TRUE AND pl.negocio_id IS NULL
        AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas' AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NULL AND pl.corretor_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa')
        AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
        AND public._pipeline_ultima_acao_humana(pl.id) < now() - (v_cfg.dias_limite||' days')::interval
      ORDER BY public._pipeline_ultima_acao_humana(pl.id) ASC
      LIMIT v_cfg.limite_backfill_dia
    LOOP
      UPDATE pipeline_leads SET estagnado_aviso_em=now(), estagnado_prazo_em=now()+interval '48 hours', updated_at=now() WHERE id=v_lead.id;
      INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
      VALUES (v_lead.corretor_id, 'alertas', 'lead_estagnacao_aviso',
        '⏳ Aja em 48h: '||COALESCE(v_lead.nome,'(sem nome)'),
        'Lead parado há mais de '||v_cfg.dias_limite||' dias sem nenhuma ação. Aja em 48h ou ele será repassado.',
        ARRAY['corretor'], jsonb_build_object('lead_id', v_lead.id));
      v_avisos := v_avisos + 1;
    END LOOP;

  END LOOP;

  RETURN jsonb_build_object('avisos', v_avisos, 'estagnados', v_estagnados, 'resetados', v_resetados, 'ts', now());
END;
$function$;

-- 2) Cadência Sem Contato (T7): ao marcar estagnado, também arquivar
CREATE OR REPLACE FUNCTION public.cadencia_sc_descartar_reengajavel(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_corretor  uuid;
  v_nome      text;
  v_gerente   uuid;
BEGIN
  SELECT corretor_id, nome INTO v_corretor, v_nome FROM pipeline_leads WHERE id = p_lead_id;

  UPDATE pipeline_leads
     SET estagnado = true,
         estagnado_em = now(),
         estagnado_aviso_em = NULL,
         estagnado_prazo_em = NULL,
         arquivado = true,
         updated_at = now()
   WHERE id = p_lead_id AND stage_id = sem_contato AND estagnado IS NOT TRUE;

  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (p_lead_id, sem_contato, sem_contato, v_corretor,
          'Estagnado — cadência Sem Contato esgotada (T7 / prazo de 24h sem retorno). Aguardando decisão na Central de Leads Estagnados.');

  INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
  VALUES (p_lead_id, 'sistema', 'Estagnado — cadência Sem Contato esgotada',
          'As 7 tentativas da cadência Sem Contato foram esgotadas sem retorno do lead. Lead movido para a Central de Leads Estagnados.',
          CURRENT_DATE, 'media', 'concluida', v_corretor);

  UPDATE lead_cadencia_sem_contato
     SET status = 'concluida', proxima_em = NULL, updated_at = now()
   WHERE pipeline_lead_id = p_lead_id;

  SELECT gerente_id INTO v_gerente FROM team_members WHERE user_id = v_corretor AND status = 'ativo' LIMIT 1;
  INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
  VALUES (COALESCE(v_gerente, v_corretor), 'alertas', 'lead_estagnado',
    '🛑 Lead estagnado: ' || COALESCE(v_nome, '(sem nome)'),
    'Cadência Sem Contato esgotada (T7 sem retorno). Defina o destino na Central de Leads Estagnados.',
    ARRAY['gestor','admin','diretor'], jsonb_build_object('lead_id', p_lead_id));
END;
$function$;

-- 3) Central: listar estagnados mesmo quando arquivados; candidatos/avisos só não-arquivados
CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()
 RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, corretor_id uuid, corretor_nome text, dias_limite integer, ultima_acao_humana timestamp with time zone, dias_sem_acao integer, categoria text, estagnado_prazo_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (SELECT c.stage_id, c.dias_limite FROM pipeline_estagnacao_config c WHERE c.ativo = true)
  SELECT pl.id, pl.nome, pl.empreendimento, s.nome, pl.stage_id, pl.corretor_id, pr.nome,
    COALESCE(cfg.dias_limite, 7) AS dias_limite,
    public._pipeline_ultima_acao_humana(pl.id) AS ult,
    EXTRACT(day FROM now() - public._pipeline_ultima_acao_humana(pl.id))::int,
    CASE
      WHEN pl.estagnado THEN 'estagnado'
      WHEN pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em > now() THEN 'em_aviso'
      WHEN EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa') THEN 'em_parceria'
      ELSE 'candidato'
    END,
    pl.estagnado_prazo_em
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  LEFT JOIN cfg ON cfg.stage_id = pl.stage_id
  LEFT JOIN profiles pr ON pr.user_id = pl.corretor_id
  WHERE pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
    AND (
      pl.estagnado = true
      OR (
        pl.arquivado IS NOT TRUE
        AND (
          pl.estagnado_aviso_em IS NOT NULL
          OR (cfg.stage_id IS NOT NULL
              AND public._pipeline_ultima_acao_humana(pl.id) < now() - (cfg.dias_limite || ' days')::interval)
        )
      )
    )
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'diretor')
      OR (
        public.has_role(auth.uid(),'gestor')
        AND pl.corretor_id IN (
          SELECT tm.user_id FROM public.team_members tm
          WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
        )
      )
    )
  ORDER BY ult ASC;
$function$;

-- 4) Decisão "descartar": também desarquivar para o lead reaparecer no destino correto (Descarte)
CREATE OR REPLACE FUNCTION public.decidir_lead_estagnado(p_lead_id uuid, p_acao text, p_corretor_destino uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_stage_descarte uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
  v_stage_novo_lead uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
  v_lead record;
  v_motivo text := NULLIF(trim(p_motivo), '');
  v_is_admin boolean := public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'diretor');
  v_is_gestor boolean := public.has_role(v_uid, 'gestor');
BEGIN
  IF NOT (v_is_admin OR v_is_gestor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para decidir leads estagnados');
  END IF;

  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  END IF;

  IF NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.gerente_id = v_uid AND tm.status = 'ativo' AND tm.user_id = v_lead.corretor_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lead não pertence à sua equipe');
    END IF;
  END IF;

  IF p_acao = 'devolver' THEN
    IF v_lead.corretor_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lead não possui corretor para devolução');
    END IF;

    UPDATE public.pipeline_leads SET
      stage_id = v_stage_novo_lead,
      stage_changed_at = now(),
      aceite_status = 'aceito',
      aceito_em = now(),
      aceite_expira_em = NULL,
      arquivado = false,
      ultima_acao_at = now(),
      estagnado = false,
      estagnado_em = NULL,
      estagnado_aviso_em = NULL,
      estagnado_prazo_em = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (p_lead_id, v_lead.stage_id, v_stage_novo_lead, v_uid,
      concat_ws(' ', 'Estagnação: devolvido ao corretor — cliente retornou.', v_motivo));

    RETURN jsonb_build_object('success', true, 'acao', 'devolver');

  ELSIF p_acao = 'repassar' THEN
    IF p_corretor_destino IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Corretor de destino obrigatório');
    END IF;

    UPDATE public.pipeline_leads SET
      corretor_id = p_corretor_destino,
      corretor_anterior_id = v_lead.corretor_id,
      is_redistribuicao = true,
      motivo_redistribuicao = COALESCE(v_motivo, 'Repassado via Central de Estagnação'),
      aceite_status = 'aceito',
      distribuido_em = now(),
      stage_id = v_stage_novo_lead,
      stage_changed_at = now(),
      arquivado = false,
      ultima_acao_at = now(),
      estagnado = false,
      estagnado_em = NULL,
      estagnado_aviso_em = NULL,
      estagnado_prazo_em = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (p_lead_id, v_lead.stage_id, v_stage_novo_lead, v_uid,
      concat_ws(' ', 'Estagnação: repassado para outro corretor.', v_motivo));

    RETURN jsonb_build_object('success', true, 'acao', 'repassar');

  ELSIF p_acao = 'roleta' THEN
    UPDATE public.pipeline_parcerias
      SET status = 'cancelada',
          motivo = concat_ws(' | ', nullif(motivo, ''), 'Cancelada: lead estagnado → Fila do CEO'),
          updated_at = now()
    WHERE pipeline_lead_id = p_lead_id AND status = 'ativa';

    UPDATE public.pipeline_leads SET
      aceite_status = 'pendente_distribuicao',
      corretor_anterior_id = v_lead.corretor_id,
      corretor_id = NULL,
      gerente_id = NULL,
      is_redistribuicao = true,
      motivo_redistribuicao = COALESCE(v_motivo, 'Estagnação: enviado para Fila do CEO'),
      distribuido_em = NULL,
      aceite_expira_em = NULL,
      arquivado = false,
      ultima_acao_at = now(),
      estagnado = false,
      estagnado_em = NULL,
      estagnado_aviso_em = NULL,
      estagnado_prazo_em = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (p_lead_id, v_lead.stage_id, v_lead.stage_id, v_uid,
      concat_ws(' ', 'Estagnação: enviado para a Fila do CEO (roleta).', v_motivo));

    RETURN jsonb_build_object('success', true, 'acao', 'roleta');

  ELSIF p_acao = 'descartar' THEN
    UPDATE public.pipeline_parcerias
      SET status = 'cancelada',
          motivo = concat_ws(' | ', nullif(motivo, ''), 'Cancelada: lead estagnado descartado'),
          updated_at = now()
    WHERE pipeline_lead_id = p_lead_id AND status = 'ativa';

    UPDATE public.pipeline_leads SET
      stage_id = v_stage_descarte,
      stage_changed_at = now(),
      tipo_descarte = 'reengajavel',
      motivo_descarte = COALESCE(v_motivo, 'Descartado por estagnação'),
      arquivado = false,
      ultima_acao_at = now(),
      estagnado = false,
      estagnado_em = NULL,
      estagnado_aviso_em = NULL,
      estagnado_prazo_em = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (p_lead_id, v_lead.stage_id, v_stage_descarte, v_uid,
      concat_ws(' ', 'Estagnação: descartado (reengajável).', v_motivo));

    RETURN jsonb_build_object('success', true, 'acao', 'descartar');

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Ação inválida');
  END IF;
END;
$function$;