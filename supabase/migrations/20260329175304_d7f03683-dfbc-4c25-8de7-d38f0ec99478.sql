
DROP FUNCTION IF EXISTS public.get_oportunidades_do_dia(UUID);

CREATE FUNCTION public.get_oportunidades_do_dia(p_corretor_id UUID)
RETURNS TABLE(
  tipo TEXT,
  prioridade INTEGER,
  lead_id UUID,
  lead_nome TEXT,
  lead_telefone TEXT,
  lead_temperatura TEXT,
  lead_score INTEGER,
  descricao TEXT,
  acao_sugerida TEXT,
  created_at TIMESTAMPTZ,
  lead_etapa TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_descarte_stage_id UUID;
  v_convertido_stage_id UUID;
BEGIN
  SELECT id INTO v_descarte_stage_id
  FROM pipeline_stages
  WHERE nome ILIKE '%descart%'
  LIMIT 1;

  SELECT id INTO v_convertido_stage_id
  FROM pipeline_stages
  WHERE nome ILIKE '%convertid%'
  LIMIT 1;

  RETURN QUERY

  SELECT
    'radar_intencao'::TEXT AS tipo,
    1 AS prioridade,
    pl.id AS lead_id,
    pl.nome AS lead_nome,
    pl.telefone AS lead_telefone,
    pl.lead_temperatura,
    pl.lead_score,
    'Lead com alta intenção de compra detectada pelo Radar'::TEXT AS descricao,
    'Ligar agora'::TEXT AS acao_sugerida,
    pl.lead_score_at AS created_at,
    ps.nome AS lead_etapa
  FROM pipeline_leads pl
  LEFT JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = p_corretor_id
    AND pl.lead_temperatura IN ('quente', 'urgente')
    AND pl.lead_score_at >= NOW() - INTERVAL '24 hours'
    AND (v_descarte_stage_id IS NULL OR pl.stage_id != v_descarte_stage_id)
    AND (v_convertido_stage_id IS NULL OR pl.stage_id != v_convertido_stage_id)

  UNION ALL

  SELECT
    'nurturing_resposta'::TEXT AS tipo,
    2 AS prioridade,
    pl.id AS lead_id,
    pl.nome AS lead_nome,
    pl.telefone AS lead_telefone,
    pl.lead_temperatura,
    pl.lead_score,
    'IA enviou vitrine automática para este lead'::TEXT AS descricao,
    'Verificar resposta no WhatsApp'::TEXT AS acao_sugerida,
    pa.created_at,
    ps.nome AS lead_etapa
  FROM pipeline_atividades pa
  JOIN pipeline_leads pl ON pl.id = pa.pipeline_lead_id
  LEFT JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = p_corretor_id
    AND pa.tipo = 'nurturing_automatico'
    AND pa.created_at >= NOW() - INTERVAL '24 hours'
    AND (v_descarte_stage_id IS NULL OR pl.stage_id != v_descarte_stage_id)
    AND (v_convertido_stage_id IS NULL OR pl.stage_id != v_convertido_stage_id)

  UNION ALL

  SELECT
    'tarefa_atrasada'::TEXT AS tipo,
    3 AS prioridade,
    pl.id AS lead_id,
    pl.nome AS lead_nome,
    pl.telefone AS lead_telefone,
    pl.lead_temperatura,
    pl.lead_score,
    CONCAT('Tarefa atrasada há ',
      GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - pt.vence_em::timestamptz)) / 3600, 0))::TEXT,
      'h: ', pt.titulo
    ) AS descricao,
    'Resolver tarefa pendente'::TEXT AS acao_sugerida,
    pt.vence_em::timestamptz AS created_at,
    ps.nome AS lead_etapa
  FROM pipeline_tarefas pt
  JOIN pipeline_leads pl ON pl.id = pt.pipeline_lead_id
  LEFT JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pt.responsavel_id = p_corretor_id
    AND pt.concluida_em IS NULL
    AND pt.status = 'pendente'
    AND pt.vence_em < NOW()
    AND (v_descarte_stage_id IS NULL OR pl.stage_id != v_descarte_stage_id)
    AND (v_convertido_stage_id IS NULL OR pl.stage_id != v_convertido_stage_id)

  UNION ALL

  SELECT
    'tarefa_atrasada'::TEXT AS tipo,
    4 AS prioridade,
    pl.id AS lead_id,
    pl.nome AS lead_nome,
    pl.telefone AS lead_telefone,
    pl.lead_temperatura,
    pl.lead_score,
    CONCAT('Lead sem tarefa pendente há ',
      GREATEST(1, EXTRACT(DAY FROM NOW() - pl.updated_at)::INTEGER)::TEXT,
      ' dia(s)'
    ) AS descricao,
    'Criar tarefa de follow-up'::TEXT AS acao_sugerida,
    pl.updated_at AS created_at,
    ps.nome AS lead_etapa
  FROM pipeline_leads pl
  LEFT JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = p_corretor_id
    AND (pl.arquivado IS NULL OR pl.arquivado = false)
    AND (v_descarte_stage_id IS NULL OR pl.stage_id != v_descarte_stage_id)
    AND (v_convertido_stage_id IS NULL OR pl.stage_id != v_convertido_stage_id)
    AND NOT EXISTS (
      SELECT 1
      FROM pipeline_tarefas pt
      WHERE pt.pipeline_lead_id = pl.id
        AND pt.status = 'pendente'
        AND pt.concluida_em IS NULL
    )

  ORDER BY prioridade ASC, created_at DESC
  LIMIT 20;
END;
$$;
