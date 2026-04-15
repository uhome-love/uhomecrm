
-- Table to store manual unblock overrides
CREATE TABLE public.roleta_desbloqueios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id UUID NOT NULL,
  desbloqueado_por UUID NOT NULL,
  mes TEXT NOT NULL, -- format: YYYY-MM
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one override per broker per month
CREATE UNIQUE INDEX idx_roleta_desbloqueios_unique ON roleta_desbloqueios (corretor_id, mes);

ALTER TABLE public.roleta_desbloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view unblocks"
  ON public.roleta_desbloqueios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert unblocks"
  ON public.roleta_desbloqueios FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete unblocks"
  ON public.roleta_desbloqueios FOR DELETE TO authenticated USING (true);

-- Update the eligibility function to check for manual overrides
CREATE OR REPLACE FUNCTION public.get_elegibilidade_roleta(p_corretor_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leads_desatualizados  INTEGER;
  v_pode_roleta_geral     BOOLEAN;
  v_tem_visita_hoje       BOOLEAN;
  v_pode_roleta_noturna   BOOLEAN;
  v_leads_detalhes        JSON;
  v_descartes_mes         INTEGER;
  v_bloqueado_descarte    BOOLEAN;
  v_visitas_semana        INTEGER;
  v_pode_domingo          BOOLEAN;
  v_limite_leads          INTEGER;
  v_limite_descartes      INTEGER;
  v_visitas_min_domingo   INTEGER;
  v_monday_date           DATE;
  v_saturday_date         DATE;
  v_today_brt             DATE;
  v_profile_id            UUID;
  v_desbloqueio_manual    BOOLEAN;
BEGIN
  v_leads_desatualizados := contar_leads_desatualizados(p_corretor_id);

  -- Load configurable limits
  SELECT COALESCE((SELECT valor::INTEGER FROM roleta_config WHERE chave = 'limite_leads_desatualizados'), 10) INTO v_limite_leads;
  SELECT COALESCE((SELECT valor::INTEGER FROM roleta_config WHERE chave = 'limite_descartes_mes'), 50) INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::INTEGER FROM roleta_config WHERE chave = 'visitas_minimas_domingo'), 2) INTO v_visitas_min_domingo;

  -- Count discards in the current month
  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM pipeline_leads pl
  WHERE pl.corretor_id = p_corretor_id
    AND pl.stage_id = '1dd66c25-3848-4053-9f66-82e902989b4d'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  -- Check for manual override
  SELECT EXISTS (
    SELECT 1 FROM roleta_desbloqueios
    WHERE corretor_id = p_corretor_id
      AND mes = to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO v_desbloqueio_manual;

  v_bloqueado_descarte := v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio_manual;
  v_pode_roleta_geral  := v_leads_desatualizados <= v_limite_leads AND NOT v_bloqueado_descarte;

  -- Check visits today
  SELECT EXISTS (
    SELECT 1
    FROM pipeline_atividades pa
    WHERE pa.corretor_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND pa.created_at::date = CURRENT_DATE
  ) INTO v_tem_visita_hoje;

  v_pode_roleta_noturna := v_pode_roleta_geral AND v_tem_visita_hoje;

  -- Count visits realized Mon-Sat of current week (for Sunday eligibility)
  v_today_brt := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_monday_date := v_today_brt - ((EXTRACT(DOW FROM v_today_brt)::INTEGER + 6) % 7);
  v_saturday_date := v_monday_date + 5;

  -- Get profile_id from auth user_id
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = p_corretor_id LIMIT 1;

  SELECT COUNT(*)::INTEGER INTO v_visitas_semana
  FROM visitas v
  WHERE (v.corretor_id = p_corretor_id OR v.corretor_id = v_profile_id::TEXT)
    AND v.status = 'realizada'
    AND v.data_visita >= v_monday_date
    AND v.data_visita <= v_saturday_date;

  v_pode_domingo := v_pode_roleta_geral AND v_visitas_semana >= v_visitas_min_domingo;

  -- Stale leads details
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
      AND pl.stage_id != '1dd66c25-3848-4053-9f66-82e902989b4d'
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
    'pode_domingo',         v_pode_domingo,
    'visitas_semana',       v_visitas_semana,
    'visitas_min_domingo',  v_visitas_min_domingo,
    'leads_desatualizados', v_leads_desatualizados,
    'limite_bloqueio',      v_limite_leads,
    'faltam_para_bloquear', GREATEST(0, v_limite_leads - v_leads_desatualizados),
    'tem_visita_hoje',      v_tem_visita_hoje,
    'leads_para_atualizar', COALESCE(v_leads_detalhes, '[]'::json),
    'descartes_mes',        v_descartes_mes,
    'bloqueado_descarte',   v_bloqueado_descarte,
    'limite_descartes',     v_limite_descartes
  );
END;
$$;
