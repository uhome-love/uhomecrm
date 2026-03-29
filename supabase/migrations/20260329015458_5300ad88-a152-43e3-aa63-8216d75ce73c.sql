
CREATE OR REPLACE FUNCTION contar_leads_desatualizados(p_corretor_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM pipeline_leads pl
  WHERE pl.corretor_id = p_corretor_id
    AND (pl.arquivado IS NULL OR pl.arquivado = false)
    AND NOT EXISTS (
      SELECT 1
      FROM pipeline_tarefas pt
      WHERE pt.pipeline_lead_id = pl.id
        AND pt.status = 'pendente'
        AND pt.vence_em >= NOW()
    );
$$;

CREATE OR REPLACE FUNCTION corretor_pode_entrar_roleta(p_corretor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_leads_desatualizados INTEGER;
BEGIN
  v_leads_desatualizados := contar_leads_desatualizados(p_corretor_id);
  IF v_leads_desatualizados > 10 THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION corretor_pode_entrar_roleta_noturna(p_corretor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pode_roleta_geral BOOLEAN;
  v_tem_visita_hoje   BOOLEAN;
BEGIN
  v_pode_roleta_geral := corretor_pode_entrar_roleta(p_corretor_id);
  IF NOT v_pode_roleta_geral THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pipeline_atividades pa
    WHERE pa.corretor_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND pa.created_at::date = CURRENT_DATE
  ) INTO v_tem_visita_hoje;

  RETURN v_tem_visita_hoje;
END;
$$;

CREATE OR REPLACE FUNCTION get_elegibilidade_roleta(p_corretor_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_leads_desatualizados  INTEGER;
  v_pode_roleta_geral     BOOLEAN;
  v_tem_visita_hoje       BOOLEAN;
  v_pode_roleta_noturna   BOOLEAN;
  v_leads_detalhes        JSON;
BEGIN
  v_leads_desatualizados := contar_leads_desatualizados(p_corretor_id);
  v_pode_roleta_geral    := v_leads_desatualizados <= 10;

  SELECT EXISTS (
    SELECT 1
    FROM pipeline_atividades pa
    WHERE pa.corretor_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND pa.created_at::date = CURRENT_DATE
  ) INTO v_tem_visita_hoje;

  v_pode_roleta_noturna := v_pode_roleta_geral AND v_tem_visita_hoje;

  SELECT json_agg(sub)
  INTO v_leads_detalhes
  FROM (
    SELECT
      json_build_object(
        'id',    pl.id,
        'nome',  pl.nome,
        'stage', ps.nome,
        'dias_sem_tarefa', EXTRACT(DAY FROM NOW() - pl.updated_at)::INTEGER
      ) AS sub
    FROM pipeline_leads pl
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.corretor_id = p_corretor_id
      AND (pl.arquivado IS NULL OR pl.arquivado = false)
      AND NOT EXISTS (
        SELECT 1
        FROM pipeline_tarefas pt
        WHERE pt.pipeline_lead_id = pl.id
          AND pt.status = 'pendente'
          AND pt.vence_em >= NOW()
      )
    ORDER BY pl.updated_at ASC
    LIMIT 10
  ) t;

  RETURN json_build_object(
    'pode_roleta_manha',    v_pode_roleta_geral,
    'pode_roleta_tarde',    v_pode_roleta_geral,
    'pode_roleta_noturna',  v_pode_roleta_noturna,
    'leads_desatualizados', v_leads_desatualizados,
    'limite_bloqueio',      10,
    'faltam_para_bloquear', GREATEST(0, 10 - v_leads_desatualizados),
    'tem_visita_hoje',      v_tem_visita_hoje,
    'leads_para_atualizar', COALESCE(v_leads_detalhes, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION corretor_pode_entrar_roleta(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION corretor_pode_entrar_roleta_noturna(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_elegibilidade_roleta(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION contar_leads_desatualizados(UUID) TO authenticated;
