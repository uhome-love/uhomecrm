
-- 1) Nova referência de inatividade: maior entre última ação humana e o vencimento da tarefa atrasada mais recente
CREATE OR REPLACE FUNCTION public._pipeline_referencia_estagnacao(_lead_id uuid)
RETURNS timestamp with time zone
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    public._pipeline_ultima_acao_humana(_lead_id),
    COALESCE(
      (SELECT MAX((t.vence_em + interval '1 day') AT TIME ZONE 'America/Sao_Paulo')
         FROM public.pipeline_tarefas t
        WHERE t.pipeline_lead_id = _lead_id
          AND t.concluida_em IS NULL
          AND COALESCE(t.status,'') <> 'concluida'
          AND t.vence_em < (now() AT TIME ZONE 'America/Sao_Paulo')::date),
      'epoch'::timestamptz
    )
  )
$function$;

-- 2) Motor de estagnação usa a nova referência
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

    UPDATE pipeline_leads pl
      SET estagnado=false, estagnado_em=NULL, estagnado_aviso_em=NULL, estagnado_prazo_em=NULL, arquivado=false, updated_at=now()
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado=true
        AND (
          public._pipeline_referencia_estagnacao(pl.id) > pl.estagnado_em
          OR public._pipeline_tem_tarefa_pendente_futura(pl.id)
        );
    GET DIAGNOSTICS v_resetados = ROW_COUNT;

    UPDATE pipeline_leads pl
      SET estagnado_aviso_em=NULL, estagnado_prazo_em=NULL, updated_at=now()
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NOT NULL
        AND (
          public._pipeline_referencia_estagnacao(pl.id) > pl.estagnado_aviso_em
          OR public._pipeline_tem_tarefa_pendente_futura(pl.id)
        );

    FOR v_lead IN
      SELECT pl.id, pl.corretor_id, pl.nome FROM pipeline_leads pl
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em < now()
        AND public._pipeline_referencia_estagnacao(pl.id) <= pl.estagnado_aviso_em
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

    FOR v_lead IN
      SELECT pl.id, pl.corretor_id, pl.nome FROM pipeline_leads pl
      WHERE pl.stage_id=v_cfg.stage_id AND pl.arquivado IS NOT TRUE AND pl.negocio_id IS NULL
        AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas' AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NULL AND pl.corretor_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa')
        AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
        AND public._pipeline_referencia_estagnacao(pl.id) < now() - (v_cfg.dias_limite||' days')::interval
      ORDER BY public._pipeline_referencia_estagnacao(pl.id) ASC
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

-- 3) Lista de leads estagnados (gestor/CEO) usa a nova referência
CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()
 RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, corretor_id uuid, corretor_nome text, dias_limite integer, ultima_acao_humana timestamp with time zone, dias_sem_acao integer, categoria text, estagnado_prazo_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (SELECT c.stage_id, c.dias_limite FROM pipeline_estagnacao_config c WHERE c.ativo = true)
  SELECT pl.id, pl.nome, pl.empreendimento, s.nome, pl.stage_id, pl.corretor_id, pr.nome,
    COALESCE(cfg.dias_limite, 7) AS dias_limite,
    public._pipeline_referencia_estagnacao(pl.id) AS ult,
    EXTRACT(day FROM now() - public._pipeline_referencia_estagnacao(pl.id))::int,
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
              AND public._pipeline_referencia_estagnacao(pl.id) < now() - (cfg.dias_limite || ' days')::interval)
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

-- 4) Aviso "prestes a estagnar" do corretor usa a nova referência
CREATE OR REPLACE FUNCTION public.get_corretor_pre_estagnacao()
 RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, dias_limite integer, dias_sem_acao integer, prazo_em timestamp with time zone, categoria text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT c.stage_id, c.dias_limite
    FROM pipeline_estagnacao_config c
    WHERE c.ativo = true
  )
  SELECT
    pl.id,
    pl.nome,
    pl.empreendimento,
    s.nome,
    pl.stage_id,
    COALESCE(cfg.dias_limite, 7) AS dias_limite,
    EXTRACT(day FROM now() - public._pipeline_referencia_estagnacao(pl.id))::int AS dias_sem_acao,
    CASE
      WHEN pl.estagnado_aviso_em IS NOT NULL THEN pl.estagnado_prazo_em
      ELSE public._pipeline_referencia_estagnacao(pl.id) + (COALESCE(cfg.dias_limite, 7) || ' days')::interval
    END AS prazo_em,
    CASE
      WHEN pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em > now() THEN 'em_aviso'
      ELSE 'proximo'
    END AS categoria
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  JOIN cfg ON cfg.stage_id = pl.stage_id
  WHERE pl.corretor_id = auth.uid()
    AND pl.estagnado IS NOT TRUE
    AND pl.arquivado IS NOT TRUE
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
    AND NOT EXISTS (
      SELECT 1 FROM pipeline_parcerias pp
      WHERE pp.pipeline_lead_id = pl.id AND pp.status = 'ativa'
    )
    AND (
      pl.estagnado_aviso_em IS NOT NULL
      OR public._pipeline_referencia_estagnacao(pl.id) < now() - ((cfg.dias_limite - 2) || ' days')::interval
    )
  ORDER BY prazo_em ASC;
$function$;

-- 5) Contador para o modal do lead
CREATE OR REPLACE FUNCTION public.get_lead_estagnacao_status(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_dias_limite int;
  v_ref timestamptz;
  v_dias_sem_acao int;
  v_prazo timestamptz;
  v_dias_para int;
  v_categoria text;
  v_em_parceria boolean;
BEGIN
  SELECT pl.id, pl.stage_id, pl.estagnado, pl.estagnado_aviso_em, pl.estagnado_prazo_em,
         pl.arquivado, pl.negocio_id, pl.modulo_atual
    INTO v_lead
  FROM pipeline_leads pl WHERE pl.id = p_lead_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('tem_config', false);
  END IF;

  SELECT c.dias_limite INTO v_dias_limite
  FROM pipeline_estagnacao_config c
  WHERE c.stage_id = v_lead.stage_id AND c.ativo = true;

  IF v_dias_limite IS NULL
     OR v_lead.negocio_id IS NOT NULL
     OR COALESCE(v_lead.modulo_atual,'') = 'pos_vendas' THEN
    RETURN jsonb_build_object('tem_config', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pipeline_parcerias pp
    WHERE pp.pipeline_lead_id = p_lead_id AND pp.status = 'ativa'
  ) INTO v_em_parceria;

  IF v_em_parceria THEN
    RETURN jsonb_build_object('tem_config', false);
  END IF;

  -- Lead protegido por tarefa pendente futura: contagem pausada
  IF public._pipeline_tem_tarefa_pendente_futura(p_lead_id) THEN
    RETURN jsonb_build_object(
      'tem_config', true,
      'dias_limite', v_dias_limite,
      'dias_sem_acao', 0,
      'dias_para_estagnar', v_dias_limite,
      'categoria', 'tranquilo',
      'protegido', true
    );
  END IF;

  v_ref := public._pipeline_referencia_estagnacao(p_lead_id);
  v_dias_sem_acao := GREATEST(0, EXTRACT(day FROM now() - v_ref)::int);

  IF v_lead.estagnado THEN
    RETURN jsonb_build_object(
      'tem_config', true, 'dias_limite', v_dias_limite,
      'dias_sem_acao', v_dias_sem_acao, 'dias_para_estagnar', 0,
      'categoria', 'estagnado', 'protegido', false
    );
  END IF;

  IF v_lead.estagnado_aviso_em IS NOT NULL AND v_lead.estagnado_prazo_em > now() THEN
    v_dias_para := GREATEST(0, CEIL(EXTRACT(epoch FROM v_lead.estagnado_prazo_em - now()) / 86400.0)::int);
    RETURN jsonb_build_object(
      'tem_config', true, 'dias_limite', v_dias_limite,
      'dias_sem_acao', v_dias_sem_acao, 'dias_para_estagnar', v_dias_para,
      'categoria', 'em_aviso', 'protegido', false,
      'prazo_em', v_lead.estagnado_prazo_em
    );
  END IF;

  v_prazo := v_ref + (v_dias_limite || ' days')::interval;
  v_dias_para := GREATEST(0, CEIL(EXTRACT(epoch FROM v_prazo - now()) / 86400.0)::int);

  IF v_dias_para <= 2 THEN
    v_categoria := 'atencao';
  ELSE
    v_categoria := 'tranquilo';
  END IF;

  RETURN jsonb_build_object(
    'tem_config', true, 'dias_limite', v_dias_limite,
    'dias_sem_acao', v_dias_sem_acao, 'dias_para_estagnar', v_dias_para,
    'categoria', v_categoria, 'protegido', false, 'prazo_em', v_prazo
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_lead_estagnacao_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._pipeline_referencia_estagnacao(uuid) TO authenticated, service_role;
