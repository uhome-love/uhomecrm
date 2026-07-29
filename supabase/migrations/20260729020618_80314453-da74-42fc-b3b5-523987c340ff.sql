CREATE OR REPLACE FUNCTION public.escalonar_notificacoes_leads()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_count integer := 0;
  v_seconds_left integer;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.nome, pl.corretor_id, pl.distribuido_em, pl.aceite_expira_em, pl.escalation_level,
           pl.telefone, pl.empreendimento
    FROM pipeline_leads pl
    WHERE pl.aceite_status IN ('pendente', 'aguardando_aceite', 'pendente_aceite')
      AND pl.corretor_id IS NOT NULL
      AND pl.distribuido_em IS NOT NULL
      AND pl.aceite_expira_em IS NOT NULL
  LOOP
    v_seconds_left := GREATEST(0, EXTRACT(EPOCH FROM (v_lead.aceite_expira_em - now()))::integer);

    -- Nível 1: aviso antecipado quando restam entre 3 e 5 min
    IF v_seconds_left <= 300 AND v_seconds_left > 180 AND v_lead.escalation_level < 1 THEN
      PERFORM criar_notificacao(
        v_lead.corretor_id, 'leads', 'lead_urgente',
        '⏳ Faltam 5 min para aceitar o lead',
        'Aceite o lead ' || COALESCE(v_lead.nome, 'N/A') || ' — ele será repassado em breve.',
        jsonb_build_object('lead_id', v_lead.id, 'pipeline_lead_id', v_lead.id, 'urgencia', 'alta', 'url', '/aceite?lead=' || v_lead.id::text),
        'lead_urgente_' || v_lead.id::text
      );
      UPDATE pipeline_leads SET escalation_level = 1, last_escalation_at = now() WHERE id = v_lead.id;
      v_count := v_count + 1;

    -- Nível 2: último aviso quando restam 3 min ou menos
    ELSIF v_seconds_left <= 180 AND v_lead.escalation_level < 2 THEN
      PERFORM criar_notificacao(
        v_lead.corretor_id, 'leads', 'lead_ultimo_alerta',
        '🚨 Últimos 3 min — aceite o lead agora',
        COALESCE(v_lead.nome, 'Este lead') || ' será redistribuído em até 3 min se você não aceitar.',
        jsonb_build_object('lead_id', v_lead.id, 'pipeline_lead_id', v_lead.id, 'urgencia', 'critica', 'url', '/aceite?lead=' || v_lead.id::text),
        'lead_ultimo_alerta_' || v_lead.id::text
      );
      UPDATE pipeline_leads SET escalation_level = 2, last_escalation_at = now() WHERE id = v_lead.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- Corrigir decidir_lead_estagnado: zerar aceite_expira_em em repassar/devolver
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
      escalation_level = 0,
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
      aceito_em = now(),
      aceite_expira_em = NULL,
      escalation_level = 0,
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
      escalation_level = 0,
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
      concat_ws(' ', 'Estagnação: enviado para Fila do CEO para redistribuição.', v_motivo));

    RETURN jsonb_build_object('success', true, 'acao', 'roleta');

  ELSIF p_acao = 'descartar' THEN
    UPDATE public.pipeline_leads SET
      stage_id = v_stage_descarte,
      stage_changed_at = now(),
      descartado_em = now(),
      descarte_motivo = COALESCE(v_motivo, 'Descartado via Central de Estagnação'),
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
      concat_ws(' ', 'Estagnação: descartado.', v_motivo));

    RETURN jsonb_build_object('success', true, 'acao', 'descartar');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Ação inválida');
END;
$function$;