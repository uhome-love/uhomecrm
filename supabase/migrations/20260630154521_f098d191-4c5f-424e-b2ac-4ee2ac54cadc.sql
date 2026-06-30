
-- 1. Helper: lead tem tarefa pendente futura?
CREATE OR REPLACE FUNCTION public._pipeline_tem_tarefa_pendente_futura(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_tarefas t
    WHERE t.pipeline_lead_id = _lead_id
      AND t.concluida_em IS NULL
      AND COALESCE(t.status,'') <> 'concluida'
      AND t.vence_em >= CURRENT_DATE
  )
$function$;

-- 2. get_pipeline_estagnacao: exclui leads com tarefa pendente futura
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
  WHERE pl.arquivado IS NOT TRUE
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
    AND (
      pl.estagnado = true
      OR pl.estagnado_aviso_em IS NOT NULL
      OR (cfg.stage_id IS NOT NULL
          AND public._pipeline_ultima_acao_humana(pl.id) < now() - (cfg.dias_limite || ' days')::interval)
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

-- 3. processar_estagnacao_pipeline: respeita tarefa pendente futura
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

    -- Reset: lead já estagnado que recebeu ação humana OU tem tarefa pendente futura → sai da estagnação
    UPDATE pipeline_leads pl
      SET estagnado=false, estagnado_em=NULL, estagnado_aviso_em=NULL, estagnado_prazo_em=NULL, updated_at=now()
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

    -- Confirma estagnação: aviso vencido sem ação (e sem tarefa pendente futura)
    FOR v_lead IN
      SELECT pl.id, pl.corretor_id, pl.nome FROM pipeline_leads pl
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em < now()
        AND public._pipeline_ultima_acao_humana(pl.id) <= pl.estagnado_aviso_em
        AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
    LOOP
      UPDATE pipeline_leads SET estagnado=true, estagnado_em=now(), updated_at=now() WHERE id=v_lead.id;
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

-- 4. Trigger: teto de 30 dias para agendamento de tarefas
CREATE OR REPLACE FUNCTION public._pipeline_tarefas_cap_30d()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.vence_em IS NOT NULL
     AND NEW.concluida_em IS NULL
     AND COALESCE(NEW.status,'') <> 'concluida'
     AND NEW.vence_em > CURRENT_DATE + 30 THEN
    RAISE EXCEPTION 'Tarefas podem ser agendadas para no máximo 30 dias à frente.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pipeline_tarefas_cap_30d ON public.pipeline_tarefas;
CREATE TRIGGER trg_pipeline_tarefas_cap_30d
  BEFORE INSERT OR UPDATE OF vence_em ON public.pipeline_tarefas
  FOR EACH ROW EXECUTE FUNCTION public._pipeline_tarefas_cap_30d();
