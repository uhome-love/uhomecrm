CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()
 RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, corretor_id uuid, corretor_nome text, dias_limite integer, ultima_acao_humana timestamp with time zone, dias_sem_acao integer, categoria text, estagnado_prazo_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (SELECT c.stage_id, c.dias_limite FROM pipeline_estagnacao_config c)
  SELECT pl.id, pl.nome, pl.empreendimento, s.nome, pl.stage_id, pl.corretor_id, pr.nome,
    cfg.dias_limite,
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
  JOIN cfg ON cfg.stage_id = pl.stage_id
  LEFT JOIN profiles pr ON pr.user_id = pl.corretor_id
  WHERE pl.arquivado IS NOT TRUE
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND (pl.estagnado = true OR pl.estagnado_aviso_em IS NOT NULL
      OR public._pipeline_ultima_acao_humana(pl.id) < now() - (cfg.dias_limite || ' days')::interval)
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

CREATE OR REPLACE FUNCTION public.decidir_lead_estagnado(
  p_lead_id uuid,
  p_acao text,
  p_corretor_destino uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_stage_descarte uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
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

  -- Gestor só decide sobre leads da própria equipe
  IF NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.gerente_id = v_uid AND tm.status = 'ativo' AND tm.user_id = v_lead.corretor_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lead não pertence à sua equipe');
    END IF;
  END IF;

  IF p_acao = 'repassar' THEN
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
      ultima_acao_at = now(),
      estagnado = false,
      estagnado_em = NULL,
      estagnado_aviso_em = NULL,
      estagnado_prazo_em = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (p_lead_id, v_lead.stage_id, v_lead.stage_id, v_uid,
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