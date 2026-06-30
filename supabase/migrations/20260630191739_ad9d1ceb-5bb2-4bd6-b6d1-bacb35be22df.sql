ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS estagnado_aviso2_em timestamptz;

CREATE OR REPLACE FUNCTION public.processar_estagnacao_pipeline()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avisos int := 0; v_avisos2 int := 0; v_estagnados int := 0; v_resetados int := 0;
  v_cfg record; v_lead record; v_gerente uuid;
  c_aquecimento uuid := 'b0a94ce6-b295-45b8-a023-b23e140d0ba4';
BEGIN
  FOR v_cfg IN SELECT stage_id, dias_limite, limite_backfill_dia FROM pipeline_estagnacao_config WHERE ativo = true LOOP

    UPDATE pipeline_leads pl
      SET estagnado=false, estagnado_em=NULL, estagnado_aviso_em=NULL, estagnado_aviso2_em=NULL, estagnado_prazo_em=NULL, arquivado=false, updated_at=now()
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado=true
        AND (
          public._pipeline_referencia_estagnacao(pl.id) > pl.estagnado_em
          OR public._pipeline_tem_tarefa_pendente_futura(pl.id)
        );
    GET DIAGNOSTICS v_resetados = ROW_COUNT;

    UPDATE pipeline_leads pl
      SET estagnado_aviso_em=NULL, estagnado_aviso2_em=NULL, estagnado_prazo_em=NULL, updated_at=now()
      WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado IS NOT TRUE
        AND pl.estagnado_aviso_em IS NOT NULL
        AND (
          public._pipeline_referencia_estagnacao(pl.id) > pl.estagnado_aviso_em
          OR public._pipeline_tem_tarefa_pendente_futura(pl.id)
        );

    -- Segundo aviso (somente Aquecimento): 24h antes do prazo final
    IF v_cfg.stage_id = c_aquecimento THEN
      FOR v_lead IN
        SELECT pl.id, pl.corretor_id, pl.nome FROM pipeline_leads pl
        WHERE pl.stage_id=v_cfg.stage_id AND pl.estagnado IS NOT TRUE
          AND pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_aviso2_em IS NULL
          AND pl.estagnado_prazo_em IS NOT NULL
          AND now() >= pl.estagnado_prazo_em - interval '24 hours'
          AND now() < pl.estagnado_prazo_em
          AND public._pipeline_referencia_estagnacao(pl.id) <= pl.estagnado_aviso_em
          AND NOT public._pipeline_tem_tarefa_pendente_futura(pl.id)
      LOOP
        UPDATE pipeline_leads SET estagnado_aviso2_em=now(), updated_at=now() WHERE id=v_lead.id;
        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
        VALUES (v_lead.corretor_id, 'alertas', 'lead_estagnacao_aviso',
          '⏰ Última chamada (24h): '||COALESCE(v_lead.nome,'(sem nome)'),
          'Faltam menos de 24h para este lead estagnar. Aja agora ou ele será repassado.',
          ARRAY['corretor'], jsonb_build_object('lead_id', v_lead.id));
        v_avisos2 := v_avisos2 + 1;
      END LOOP;
    END IF;

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
      UPDATE pipeline_leads SET estagnado_aviso_em=now(), estagnado_aviso2_em=NULL, estagnado_prazo_em=now()+interval '48 hours', updated_at=now() WHERE id=v_lead.id;
      INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
      VALUES (v_lead.corretor_id, 'alertas', 'lead_estagnacao_aviso',
        '⏳ Aja em 48h: '||COALESCE(v_lead.nome,'(sem nome)'),
        'Lead parado há mais de '||v_cfg.dias_limite||' dias sem nenhuma ação. Aja em 48h ou ele será repassado.',
        ARRAY['corretor'], jsonb_build_object('lead_id', v_lead.id));
      v_avisos := v_avisos + 1;
    END LOOP;

  END LOOP;

  RETURN jsonb_build_object('avisos', v_avisos, 'avisos2', v_avisos2, 'estagnados', v_estagnados, 'resetados', v_resetados, 'ts', now());
END;
$$;