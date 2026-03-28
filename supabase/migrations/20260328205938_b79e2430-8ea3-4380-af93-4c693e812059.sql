
-- =============================================================================
-- Migration: Guardião do Pipeline (ADAPTADO para banco uhome CRM real)
-- =============================================================================

-- 1. Adicionar colunas de score ao pipeline_leads
ALTER TABLE pipeline_leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_score_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_temperatura TEXT 
    GENERATED ALWAYS AS (
      CASE
        WHEN lead_score >= 10 THEN 'urgente'
        WHEN lead_score >= 5  THEN 'quente'
        WHEN lead_score >= 2  THEN 'morno'
        ELSE 'frio'
      END
    ) STORED;

-- 2. Função: verifica se o corretor pode entrar na roleta
CREATE OR REPLACE FUNCTION public.corretor_pode_entrar_roleta(p_corretor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tarefas_atrasadas INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_tarefas_atrasadas
  FROM pipeline_tarefas pt
  JOIN pipeline_leads pl ON pl.id = pt.pipeline_lead_id
  WHERE pt.responsavel_id = p_corretor_id
    AND pt.concluida_em IS NULL
    AND pt.vence_em < (NOW() - INTERVAL '24 hours')::date
  ;
  RETURN v_tarefas_atrasadas = 0;
END;
$$;

-- 3. Função: leads com tarefas atrasadas
CREATE OR REPLACE FUNCTION public.get_leads_atrasados(p_corretor_id UUID)
RETURNS TABLE (
  lead_id UUID,
  lead_nome TEXT,
  lead_telefone TEXT,
  lead_score INTEGER,
  lead_temperatura TEXT,
  tarefa_id UUID,
  tarefa_descricao TEXT,
  tarefa_vencimento DATE,
  horas_atrasado NUMERIC,
  stage_nome TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id AS lead_id,
    pl.nome AS lead_nome,
    pl.telefone AS lead_telefone,
    pl.lead_score,
    pl.lead_temperatura,
    pt.id AS tarefa_id,
    pt.titulo AS tarefa_descricao,
    pt.vence_em AS tarefa_vencimento,
    ROUND(EXTRACT(EPOCH FROM (NOW() - pt.vence_em::timestamptz)) / 3600, 1) AS horas_atrasado,
    ps.nome AS stage_nome
  FROM pipeline_tarefas pt
  JOIN pipeline_leads pl ON pl.id = pt.pipeline_lead_id
  JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pt.responsavel_id = p_corretor_id
    AND pt.concluida_em IS NULL
    AND pt.vence_em < (NOW() - INTERVAL '24 hours')::date
  ORDER BY pt.vence_em ASC
  LIMIT 20;
END;
$$;

-- 4. Função: Oportunidades do Dia
CREATE OR REPLACE FUNCTION public.get_oportunidades_do_dia(p_corretor_id UUID)
RETURNS TABLE (
  tipo TEXT,
  prioridade INTEGER,
  lead_id UUID,
  lead_nome TEXT,
  lead_telefone TEXT,
  lead_temperatura TEXT,
  lead_score INTEGER,
  descricao TEXT,
  acao_sugerida TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY

  -- Leads quentes (alta interação detectada pelo Radar)
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
    pl.lead_score_at AS created_at
  FROM pipeline_leads pl
  WHERE pl.corretor_id = p_corretor_id
    AND pl.lead_temperatura IN ('quente', 'urgente')
    AND pl.lead_score_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  -- Leads que receberam vitrine automática (nurturing)
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
    pa.created_at
  FROM pipeline_atividades pa
  JOIN pipeline_leads pl ON pl.id = pa.pipeline_lead_id
  WHERE pl.corretor_id = p_corretor_id
    AND pa.tipo = 'nurturing_automatico'
    AND pa.created_at >= NOW() - INTERVAL '24 hours'

  UNION ALL

  -- Tarefas atrasadas críticas (mais de 48h)
  SELECT
    'tarefa_atrasada'::TEXT AS tipo,
    3 AS prioridade,
    pl.id AS lead_id,
    pl.nome AS lead_nome,
    pl.telefone AS lead_telefone,
    pl.lead_temperatura,
    pl.lead_score,
    CONCAT('Tarefa atrasada há ', 
      ROUND(EXTRACT(EPOCH FROM (NOW() - pt.vence_em::timestamptz)) / 3600, 0)::TEXT,
      'h: ', pt.titulo
    ) AS descricao,
    'Resolver com 1 clique (enviar vitrine automática)'::TEXT AS acao_sugerida,
    pt.vence_em::timestamptz AS created_at
  FROM pipeline_tarefas pt
  JOIN pipeline_leads pl ON pl.id = pt.pipeline_lead_id
  WHERE pt.responsavel_id = p_corretor_id
    AND pt.concluida_em IS NULL
    AND pt.vence_em < (NOW() - INTERVAL '48 hours')::date

  ORDER BY prioridade ASC, created_at DESC
  LIMIT 15;
END;
$$;

-- 5. Trigger: registra mudança de temperatura no histórico
CREATE OR REPLACE FUNCTION public.fn_track_temperatura_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.lead_temperatura IS DISTINCT FROM NEW.lead_temperatura THEN
    INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
    VALUES (
      NEW.id,
      'temperatura_mudou',
      CONCAT('🌡️ Temperatura: ', COALESCE(OLD.lead_temperatura, 'sem score'), ' → ', NEW.lead_temperatura),
      CONCAT('Score mudou para ', NEW.lead_score),
      CURRENT_DATE,
      'normal',
      'concluida',
      COALESCE(NEW.corretor_id, '00000000-0000-0000-0000-000000000000')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_temperatura ON pipeline_leads;
CREATE TRIGGER trg_track_temperatura
  AFTER UPDATE OF lead_score ON pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_track_temperatura_change();

-- 6. View: status do corretor para roleta
CREATE OR REPLACE VIEW public.v_corretor_roleta_status AS
SELECT
  p.user_id AS corretor_id,
  p.nome,
  corretor_pode_entrar_roleta(p.user_id) AS pode_entrar_roleta,
  (
    SELECT COUNT(*)
    FROM pipeline_tarefas pt
    JOIN pipeline_leads pl ON pl.id = pt.pipeline_lead_id
    WHERE pt.responsavel_id = p.user_id
      AND pt.concluida_em IS NULL
      AND pt.vence_em < (NOW() - INTERVAL '24 hours')::date
  ) AS tarefas_atrasadas,
  (
    SELECT COUNT(*)
    FROM pipeline_leads pl
    WHERE pl.corretor_id = p.user_id
      AND pl.lead_temperatura IN ('quente', 'urgente')
  ) AS leads_quentes
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.user_id
WHERE ur.role = 'corretor';

-- Permissões
GRANT EXECUTE ON FUNCTION public.corretor_pode_entrar_roleta(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leads_atrasados(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_oportunidades_do_dia(UUID) TO authenticated;
GRANT SELECT ON public.v_corretor_roleta_status TO authenticated;
