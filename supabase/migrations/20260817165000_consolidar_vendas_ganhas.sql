-- Vendas ganhas: estado canônico e bloqueio de redistribuição acidental.

CREATE OR REPLACE FUNCTION public.lead_em_estado_final(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_leads pl
    LEFT JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.id = p_lead_id
      AND (
        ps.tipo IN ('venda', 'contrato_gerado')
        OR EXISTS (
          SELECT 1
          FROM public.negocios n
          WHERE n.fase = 'ganho'
            AND COALESCE(n.status, 'ativo') = 'ativo'
            AND (n.id = pl.negocio_id OR n.pipeline_lead_id = pl.id OR n.lead_id = pl.id)
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.lead_em_estado_final(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_em_estado_final(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consolidar_lead_ganho(p_negocio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio record;
  v_lead_id uuid;
  v_user_id uuid;
  v_stage_venda uuid;
  v_changed integer := 0;
BEGIN
  SELECT * INTO v_negocio
  FROM public.negocios
  WHERE id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'negocio_not_found');
  END IF;

  IF v_negocio.fase IS DISTINCT FROM 'ganho' OR COALESCE(v_negocio.status, 'ativo') <> 'ativo' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'negocio_not_won');
  END IF;

  v_lead_id := COALESCE(v_negocio.pipeline_lead_id, v_negocio.lead_id);
  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_linked');
  END IF;

  SELECT p.user_id INTO v_user_id
  FROM public.profiles p
  WHERE p.id = v_negocio.corretor_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'broker_user_not_found');
  END IF;

  SELECT ps.id INTO v_stage_venda
  FROM public.pipeline_stages ps
  WHERE ps.tipo = 'venda'
    AND COALESCE(ps.ativo, true)
  ORDER BY ps.ordem
  LIMIT 1;

  IF v_stage_venda IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'won_stage_not_found');
  END IF;

  UPDATE public.pipeline_leads pl
  SET stage_id = v_stage_venda,
      stage_changed_at = CASE WHEN pl.stage_id IS DISTINCT FROM v_stage_venda THEN now() ELSE pl.stage_changed_at END,
      negocio_id = v_negocio.id,
      corretor_id = v_user_id,
      aceite_status = 'aceito',
      aceito_em = COALESCE(pl.aceito_em, now()),
      distribuido_em = COALESCE(pl.distribuido_em, now()),
      aceite_expira_em = NULL,
      motivo_rejeicao = NULL,
      motivo_pendencia = NULL,
      arquivado = false,
      updated_at = now()
  WHERE pl.id = v_lead_id
    AND (
      pl.stage_id IS DISTINCT FROM v_stage_venda
      OR pl.negocio_id IS DISTINCT FROM v_negocio.id
      OR pl.corretor_id IS DISTINCT FROM v_user_id
      OR pl.aceite_status IS DISTINCT FROM 'aceito'
      OR pl.aceite_expira_em IS NOT NULL
      OR pl.motivo_rejeicao IS NOT NULL
      OR pl.motivo_pendencia IS NOT NULL
      OR pl.arquivado IS DISTINCT FROM false
    );

  GET DIAGNOSTICS v_changed = ROW_COUNT;

  IF v_changed > 0 AND NOT EXISTS (
    SELECT 1 FROM public.negocios_atividades na
    WHERE na.negocio_id = v_negocio.id AND na.tipo = 'lead_ganho_consolidado'
  ) THEN
    INSERT INTO public.negocios_atividades (negocio_id, tipo, titulo, descricao, created_by)
    VALUES (
      v_negocio.id,
      'lead_ganho_consolidado',
      'Lead consolidado como Ganho',
      'Aceite, corretor, etapa e vínculo do lead foram consolidados automaticamente.',
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'changed', v_changed > 0, 'lead_id', v_lead_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.consolidar_lead_ganho(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consolidar_lead_ganho(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_consolidar_lead_ganho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fase = 'ganho' AND COALESCE(NEW.status, 'ativo') = 'ativo' THEN
    PERFORM public.consolidar_lead_ganho(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_consolidar_lead_ganho ON public.negocios;
CREATE TRIGGER trg_consolidar_lead_ganho
AFTER INSERT OR UPDATE OF fase, status, corretor_id, pipeline_lead_id, lead_id
ON public.negocios
FOR EACH ROW
EXECUTE FUNCTION public.trg_consolidar_lead_ganho();


CREATE OR REPLACE FUNCTION public.trg_proteger_lead_ganho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corretor_esperado uuid;
BEGIN
  SELECT p.user_id INTO v_corretor_esperado
  FROM public.negocios n
  JOIN public.profiles p ON p.id = n.corretor_id
  WHERE n.fase = 'ganho'
    AND COALESCE(n.status, 'ativo') = 'ativo'
    AND (n.id = OLD.negocio_id OR n.pipeline_lead_id = OLD.id OR n.lead_id = OLD.id)
  ORDER BY n.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_corretor_esperado IS NOT NULL
     AND (
       NEW.corretor_id IS DISTINCT FROM v_corretor_esperado
       OR NEW.aceite_status IS DISTINCT FROM 'aceito'
       OR NEW.aceite_expira_em IS NOT NULL
       OR NEW.arquivado IS DISTINCT FROM false
     ) THEN
    RAISE EXCEPTION 'Lead com venda ganha não pode voltar à distribuição'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_proteger_lead_ganho ON public.pipeline_leads;
CREATE TRIGGER trg_proteger_lead_ganho
BEFORE UPDATE OF corretor_id, aceite_status, aceite_expira_em, arquivado
ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_proteger_lead_ganho();

CREATE OR REPLACE FUNCTION public.rejeitar_lead(p_lead_id uuid, p_corretor_id uuid, p_motivo text DEFAULT 'outro'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_now  timestamptz := now();
BEGIN
  PERFORM public.assert_acts_as(p_corretor_id);
  SELECT id, corretor_id, aceite_status
  INTO v_lead
  FROM pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF public.lead_em_estado_final(p_lead_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_final_blocked');
  END IF;

  IF v_lead.corretor_id IS DISTINCT FROM p_corretor_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_your_lead');
  END IF;

  IF v_lead.aceite_status NOT IN ('pendente', 'aguardando_aceite', 'pendente_aceite') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_pending');
  END IF;

  UPDATE pipeline_leads
  SET aceite_status  = 'pendente_distribuicao',
      corretor_id    = NULL,
      distribuido_em = NULL,
      aceite_expira_em = NULL,
      updated_at     = v_now
  WHERE id = p_lead_id;

  UPDATE roleta_distribuicoes
  SET status = 'recusado'
  WHERE lead_id = p_lead_id AND status = 'aguardando';

  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao)
  VALUES (p_lead_id, p_corretor_id, 'rejeitado', p_motivo);

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.expirar_aceites_roleta()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT := 0;
  v_lead RECORD;
  v_lead_nome TEXT;
  v_lead_emp TEXT;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.corretor_id, pl.nome, pl.empreendimento
    FROM public.pipeline_leads pl
    WHERE pl.aceite_status = 'aguardando_aceite'
      AND pl.aceite_expira_em IS NOT NULL
      AND pl.aceite_expira_em < (now() - interval '30 seconds')
      AND NOT public.lead_em_estado_final(pl.id)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.roleta_distribuicoes
       SET status = 'expirado'
     WHERE lead_id = v_lead.id AND status = 'aguardando';

    -- Notifica o corretor que perdeu o lead (antes de limpar corretor_id)
    IF v_lead.corretor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
      VALUES (
        v_lead.corretor_id,
        'lead',
        'lead_expirado',
        '⏰ Lead perdido por expiração',
        'Você perdeu o lead ' || COALESCE(v_lead.nome, 'sem nome')
          || COALESCE(' — ' || v_lead.empreendimento, '')
          || '. O tempo de 10 minutos para aceitar expirou e ele voltou para a fila.',
        jsonb_build_object(
          'pipeline_lead_id', v_lead.id,
          'lead_nome', v_lead.nome,
          'empreendimento', v_lead.empreendimento,
          'motivo', 'sla_expirado'
        ),
        'lead_expirado_' || v_lead.id::text
      );
    END IF;

    UPDATE public.pipeline_leads
       SET aceite_status = 'pendente_distribuicao',
           corretor_id   = NULL,
           distribuido_em = NULL,
           aceite_expira_em = NULL,
           updated_at = now()
     WHERE id = v_lead.id;

    INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao, created_at)
    VALUES (v_lead.id, v_lead.corretor_id, 'timeout', 'sla_expirado', now());

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', v_count, 'at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.reciclar_leads_expirados()
 RETURNS TABLE(lead_id uuid, corretor_anterior uuid, lead_nome text, lead_empreendimento text, lead_telefone text, segmento_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_nome_anterior text;
  v_stage_atual uuid;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.corretor_id, pl.segmento_id AS seg_id, pl.distribuido_em, pl.nome, pl.empreendimento, pl.telefone, pl.stage_id
    FROM pipeline_leads pl
    WHERE pl.aceite_expira_em < (now() - interval '30 seconds')
      AND pl.aceite_status IN ('pendente', 'aguardando_aceite')
      AND pl.corretor_id IS NOT NULL
      AND NOT public.lead_em_estado_final(pl.id)
  LOOP
    SELECT nome INTO v_nome_anterior FROM profiles WHERE user_id = v_lead.corretor_id;

    INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao, motivo_rejeicao, tempo_resposta_seg)
    VALUES (
      v_lead.id,
      v_lead.corretor_id,
      v_lead.seg_id,
      'timeout',
      'tempo_excedido. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido'),
      EXTRACT(EPOCH FROM (now() - v_lead.distribuido_em))::integer
    );

    UPDATE pipeline_leads
    SET corretor_id = NULL,
        distribuido_em = NULL,
        aceite_expira_em = NULL,
        aceite_status = 'pendente_distribuicao',
        updated_at = now()
    WHERE id = v_lead.id
      AND aceite_status IN ('pendente', 'aguardando_aceite');

    IF FOUND THEN
      INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
      VALUES (
        v_lead.id,
        v_lead.stage_id,
        v_lead.stage_id,
        v_lead.corretor_id,
        'Lead expirou sem aceite e será redistribuído. Corretor anterior: ' || COALESCE(v_nome_anterior, 'Desconhecido')
      );

      lead_id := v_lead.id;
      corretor_anterior := v_lead.corretor_id;
      lead_nome := v_lead.nome;
      lead_empreendimento := v_lead.empreendimento;
      lead_telefone := v_lead.telefone;
      segmento_id := v_lead.seg_id;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

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

  IF public.lead_em_estado_final(p_lead_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead em etapa final não pode ser redistribuído');
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
      motivo_descarte = COALESCE(v_motivo, 'Descartado via Central de Estagnação'),
      tipo_descarte = 'reengajavel',
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

-- Preserva as permissões restritas da rejeição; as demais funções mantêm seus ACLs ao serem substituídas.
REVOKE ALL ON FUNCTION public.rejeitar_lead(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rejeitar_lead(uuid, uuid, text) TO authenticated, service_role;
