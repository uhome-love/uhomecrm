
-- 1. Create roleta_config table for configurable parameters
CREATE TABLE IF NOT EXISTS public.roleta_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.roleta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read roleta_config"
  ON public.roleta_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roleta_config"
  ON public.roleta_config FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insert default config values
INSERT INTO public.roleta_config (chave, valor, descricao) VALUES
  ('limite_leads_desatualizados', '10', 'Máximo de leads desatualizados para participar da roleta'),
  ('limite_descartes_mes', '50', 'Máximo de descartes no mês antes de bloqueio'),
  ('tempo_aceite_minutos', '10', 'Minutos para aceitar um lead da roleta'),
  ('visitas_minimas_domingo', '2', 'Visitas realizadas seg-sáb necessárias para domingo'),
  ('origens_gerais', 'site,site_uhome,imovelweb,jetimob', 'Origens que distribuem para todos os segmentos (separadas por vírgula)')
ON CONFLICT (chave) DO NOTHING;

-- 2. Update distribuir_lead_atomico with correct hours and origin-based general segment
CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(
  p_lead_id UUID,
  p_janela TEXT DEFAULT NULL,
  p_exclude_auth_user_id UUID DEFAULT NULL,
  p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_segmento_id UUID;
  v_ignora_segmento BOOLEAN := FALSE;
  v_target_janela TEXT;
  v_today_date DATE;
  v_today_start TIMESTAMPTZ;
  v_janela_start TIMESTAMPTZ;
  v_is_sunday BOOLEAN;
  v_is_holiday BOOLEAN := FALSE;
  v_is_special_day BOOLEAN;
  v_chosen_fila_id UUID;
  v_chosen_profile_id UUID;
  v_chosen_auth_id UUID;
  v_now TIMESTAMPTZ := now();
  v_expire_at TIMESTAMPTZ;
  v_emp_lower TEXT;
  v_brt_hour NUMERIC;
  v_brt_minute NUMERIC;
  v_brt_mins NUMERIC;
  v_origens_gerais TEXT[];
  v_lead_origem_lower TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead_atomico'));

  SELECT id, nome, telefone, empreendimento, aceite_status, corretor_id, origem
  INTO v_lead
  FROM public.pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status NOT IN ('pendente_distribuicao', 'timeout') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  -- Load configurable general origins
  SELECT string_to_array(valor, ',') INTO v_origens_gerais
  FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN
    v_origens_gerais := ARRAY['site', 'site_uhome', 'imovelweb', 'jetimob'];
  END IF;

  v_lead_origem_lower := lower(trim(COALESCE(v_lead.origem, '')));

  -- Check if origin is "general" (distribute to all segments)
  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_ignora_segmento := TRUE;
  END IF;

  -- Resolve segment from empreendimento
  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento, '')));
  IF v_emp_lower <> '' AND NOT v_ignora_segmento THEN
    SELECT segmento_id, COALESCE(ignorar_segmento, false)
    INTO v_segmento_id, v_ignora_segmento
    FROM public.roleta_campanhas
    WHERE ativo = true
      AND (
        lower(trim(empreendimento)) = v_emp_lower
        OR v_emp_lower LIKE '%' || lower(trim(empreendimento)) || '%'
        OR lower(trim(empreendimento)) LIKE '%' || v_emp_lower || '%'
      )
    LIMIT 1;

    IF v_ignora_segmento THEN
      v_segmento_id := NULL;
    END IF;
  END IF;

  -- If origin is general, force NULL segment
  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id := NULL;
    v_ignora_segmento := TRUE;
  END IF;

  v_today_date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today_start := (date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_is_sunday := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) = 0;

  SELECT EXISTS(
    SELECT 1 FROM public.feriados WHERE data = v_today_date
  ) INTO v_is_holiday;

  v_is_special_day := v_is_sunday OR v_is_holiday;

  -- Calculate BRT time in minutes from midnight
  v_brt_hour := EXTRACT(HOUR FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_minute := EXTRACT(MINUTE FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_mins := v_brt_hour * 60 + v_brt_minute;

  IF v_is_special_day THEN
    v_target_janela := 'dia_todo';
  ELSIF p_janela IS NOT NULL AND p_janela <> 'qualquer' THEN
    v_target_janela := p_janela;
  ELSE
    -- Manhã: até 12:00, Tarde: 12:00-18:30, Noturna: 18:30+
    IF v_brt_mins < 720 THEN  -- 12:00 = 720 mins
      v_target_janela := 'manha';
    ELSIF v_brt_mins < 1110 THEN  -- 18:30 = 1110 mins
      v_target_janela := 'tarde';
    ELSE
      v_target_janela := 'noturna';
    END IF;
  END IF;

  -- Janela start for equitable counting
  IF v_is_special_day THEN
    v_janela_start := v_today_start;
  ELSIF v_target_janela = 'manha' THEN
    v_janela_start := v_today_start + interval '7 hours 30 minutes';
  ELSIF v_target_janela = 'tarde' THEN
    v_janela_start := v_today_start + interval '12 hours';
  ELSIF v_target_janela = 'noturna' THEN
    v_janela_start := v_today_start + interval '18 hours 30 minutes';
  ELSE
    v_janela_start := v_today_start;
  END IF;

  v_expire_at := v_now + interval '10 minutes';

  -- Select broker with fewest leads in this shift
  SELECT rf.id, p.id, p.user_id
  INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
  FROM public.roleta_fila rf
  INNER JOIN public.roleta_credenciamentos rc
    ON rc.id = rf.credenciamento_id
  INNER JOIN public.profiles p
    ON p.id = rf.corretor_id
  LEFT JOIN public.corretor_disponibilidade cd
    ON cd.user_id = p.user_id
  WHERE rf.data = v_today_date
    AND rf.ativo = true
    AND rc.status = 'aprovado'
    AND rc.saiu_em IS NULL
    AND rc.data = v_today_date
    AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
    AND (p_force = true OR (cd.na_roleta IS NOT NULL AND cd.na_roleta = true))
    AND (
      v_segmento_id IS NULL
      OR v_ignora_segmento = true
      OR rf.segmento_id = v_segmento_id
      OR rf.segmento_id IS NULL
    )
    AND (
      v_is_special_day
      OR rf.janela = v_target_janela
      OR rf.janela = 'dia_todo'
    )
  ORDER BY
    COALESCE((
      SELECT COUNT(*)
      FROM public.distribuicao_historico dh
      WHERE dh.corretor_id = p.user_id
        AND dh.acao = 'distribuido'
        AND dh.created_at >= v_janela_start
    ), 0) ASC,
    CASE WHEN v_segmento_id IS NOT NULL THEN COALESCE((
      SELECT COUNT(*)
      FROM public.distribuicao_historico dh
      WHERE dh.corretor_id = p.user_id
        AND dh.acao = 'distribuido'
        AND dh.segmento_id = v_segmento_id
        AND dh.created_at >= v_janela_start
    ), 0) ELSE 0 END ASC,
    COALESCE((
      SELECT COUNT(*)
      FROM public.pipeline_leads pl2
      WHERE pl2.corretor_id = p.user_id
        AND pl2.aceite_status IN ('aceito', 'aguardando_aceite')
    ), 0) ASC,
    COALESCE(cd.updated_at, rc.created_at) ASC
  LIMIT 1;

  IF v_chosen_auth_id IS NULL THEN
    UPDATE public.pipeline_leads
    SET aceite_status = 'pendente_distribuicao',
        corretor_id = NULL
    WHERE id = p_lead_id;

    RETURN jsonb_build_object('success', false, 'reason', 'no_broker_available');
  END IF;

  UPDATE public.pipeline_leads
  SET corretor_id = v_chosen_auth_id,
      aceite_status = 'aguardando_aceite',
      distribuido_em = v_now,
      aceite_expira_em = v_expire_at,
      roleta_distribuido_em = v_now
  WHERE id = p_lead_id;

  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, segmento_id)
  VALUES (p_lead_id, v_chosen_auth_id, 'distribuido', v_segmento_id);

  INSERT INTO public.roleta_distribuicoes (pipeline_lead_id, corretor_id, segmento_id)
  VALUES (p_lead_id, v_chosen_auth_id, v_segmento_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.roleta_fila
  SET leads_recebidos = leads_recebidos + 1
  WHERE id = v_chosen_fila_id;

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_chosen_auth_id,
    'profile_id', v_chosen_profile_id,
    'segmento_id', v_segmento_id,
    'janela', v_target_janela,
    'lead_nome', v_lead.nome,
    'lead_empreendimento', v_lead.empreendimento,
    'lead_telefone', v_lead.telefone,
    'lead_origem', v_lead.origem,
    'expire_at', v_expire_at
  );
END;
$function$;

-- 3. Update get_elegibilidade_roleta with Sunday visit check (seg-sáb)
CREATE OR REPLACE FUNCTION public.get_elegibilidade_roleta(p_corretor_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  v_bloqueado_descarte := v_descartes_mes >= v_limite_descartes;
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
  -- Monday of this week
  v_monday_date := v_today_brt - ((EXTRACT(DOW FROM v_today_brt)::INTEGER + 6) % 7);
  -- Saturday = Monday + 5
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
$function$;
