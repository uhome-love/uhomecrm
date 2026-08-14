-- FIX: descartar lead na página de Estagnados falhava com
--   'column "descartado_em" of relation "pipeline_leads" does not exist'
-- (gerente Gabriel não conseguia descartar). O ramo p_acao='descartar' da RPC
-- decidir_lead_estagnado gravava em colunas inexistentes (descartado_em, descarte_motivo).
-- As colunas corretas (usadas pelo descarte canônico DiscardLeadDialog) são
-- motivo_descarte + tipo_descarte. Não existe timestamp de descarte na tabela.
-- Ação rotulada "descartado (reengajável)" na UI → tipo_descarte='reengajavel'.
-- Só o ramo 'descartar' mudou; os demais (devolver/repassar/roleta) já usavam colunas válidas.

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
      stage_id = v_stage_novo_lead, stage_changed_at = now(),
      aceite_status = 'aceito', aceito_em = now(), aceite_expira_em = NULL,
      escalation_level = 0, arquivado = false, ultima_acao_at = now(),
      estagnado = false, estagnado_em = NULL, estagnado_aviso_em = NULL, estagnado_prazo_em = NULL,
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
      corretor_id = p_corretor_destino, corretor_anterior_id = v_lead.corretor_id,
      is_redistribuicao = true, motivo_redistribuicao = COALESCE(v_motivo, 'Repassado via Central de Estagnação'),
      aceite_status = 'aceito', aceito_em = now(), aceite_expira_em = NULL,
      escalation_level = 0, distribuido_em = now(),
      stage_id = v_stage_novo_lead, stage_changed_at = now(), arquivado = false, ultima_acao_at = now(),
      estagnado = false, estagnado_em = NULL, estagnado_aviso_em = NULL, estagnado_prazo_em = NULL,
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
      aceite_status = 'pendente_distribuicao', corretor_anterior_id = v_lead.corretor_id,
      corretor_id = NULL, gerente_id = NULL, is_redistribuicao = true,
      motivo_redistribuicao = COALESCE(v_motivo, 'Estagnação: enviado para Fila do CEO'),
      distribuido_em = NULL, aceite_expira_em = NULL, escalation_level = 0,
      arquivado = false, ultima_acao_at = now(),
      estagnado = false, estagnado_em = NULL, estagnado_aviso_em = NULL, estagnado_prazo_em = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (p_lead_id, v_lead.stage_id, v_stage_novo_lead, v_uid,
      concat_ws(' ', 'Estagnação: enviado para Fila do CEO para redistribuição.', v_motivo));
    RETURN jsonb_build_object('success', true, 'acao', 'roleta');

  ELSIF p_acao = 'descartar' THEN
    UPDATE public.pipeline_leads SET
      stage_id = v_stage_descarte, stage_changed_at = now(),
      motivo_descarte = COALESCE(v_motivo, 'Descartado via Central de Estagnação'),
      tipo_descarte = 'reengajavel',
      arquivado = false, ultima_acao_at = now(),
      estagnado = false, estagnado_em = NULL, estagnado_aviso_em = NULL, estagnado_prazo_em = NULL,
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
