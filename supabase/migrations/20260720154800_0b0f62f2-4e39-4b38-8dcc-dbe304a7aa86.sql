
CREATE TABLE IF NOT EXISTS public.roleta_presencas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  turno TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'na_empresa',
  chegou_em TIMESTAMPTZ,
  saiu_em TIMESTAMPTZ,
  validado_por UUID REFERENCES public.profiles(id),
  validado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roleta_presencas_turno_check CHECK (turno IN ('manha','tarde','noturna')),
  CONSTRAINT roleta_presencas_status_check CHECK (status IN ('na_empresa','saiu','falta')),
  CONSTRAINT roleta_presencas_unique UNIQUE (corretor_id, data, turno)
);

CREATE INDEX IF NOT EXISTS idx_roleta_presencas_data ON public.roleta_presencas(data, turno);
CREATE INDEX IF NOT EXISTS idx_roleta_presencas_corretor_data ON public.roleta_presencas(corretor_id, data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roleta_presencas TO authenticated;
GRANT ALL ON public.roleta_presencas TO service_role;

ALTER TABLE public.roleta_presencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read roleta_presencas"
  ON public.roleta_presencas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins/gestores insert roleta_presencas"
  ON public.roleta_presencas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins/gestores update roleta_presencas"
  ON public.roleta_presencas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins/gestores delete roleta_presencas"
  ON public.roleta_presencas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE OR REPLACE FUNCTION public.roleta_presencas_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_roleta_presencas_updated_at ON public.roleta_presencas;
CREATE TRIGGER trg_roleta_presencas_updated_at
  BEFORE UPDATE ON public.roleta_presencas
  FOR EACH ROW EXECUTE FUNCTION public.roleta_presencas_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.roleta_presencas;

CREATE OR REPLACE FUNCTION public.roleta_expand_turnos(p_turnos TEXT[])
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      CASE
        WHEN t = 'dia_todo' THEN ARRAY['manha','tarde']
        ELSE ARRAY[t]
      END
    )
    FROM unnest(p_turnos) AS t
  );
$$;

CREATE OR REPLACE FUNCTION public.roleta_marcar_presenca(
  p_corretor_id UUID,
  p_data DATE,
  p_turnos TEXT[],
  p_status TEXT,
  p_observacao TEXT DEFAULT NULL
)
RETURNS SETOF public.roleta_presencas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_validador_profile UUID;
  v_turnos_norm TEXT[];
  v_turno TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('na_empresa','saiu','falta') THEN
    RAISE EXCEPTION 'status inválido: %', p_status;
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE id = p_corretor_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = p_corretor_id LIMIT 1;
  END IF;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'corretor não encontrado: %', p_corretor_id;
  END IF;

  SELECT id INTO v_validador_profile FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  v_turnos_norm := public.roleta_expand_turnos(p_turnos);

  FOREACH v_turno IN ARRAY v_turnos_norm LOOP
    INSERT INTO public.roleta_presencas(
      corretor_id, data, turno, status, chegou_em, saiu_em, validado_por, validado_em, observacao
    ) VALUES (
      v_profile_id, p_data, v_turno, p_status,
      CASE WHEN p_status = 'na_empresa' THEN v_now ELSE NULL END,
      CASE WHEN p_status = 'saiu' THEN v_now ELSE NULL END,
      v_validador_profile, v_now, p_observacao
    )
    ON CONFLICT (corretor_id, data, turno) DO UPDATE SET
      status = EXCLUDED.status,
      chegou_em = CASE
        WHEN EXCLUDED.status = 'na_empresa' AND public.roleta_presencas.chegou_em IS NULL THEN v_now
        ELSE public.roleta_presencas.chegou_em
      END,
      saiu_em = CASE
        WHEN EXCLUDED.status = 'saiu' THEN v_now
        WHEN EXCLUDED.status = 'na_empresa' THEN NULL
        ELSE public.roleta_presencas.saiu_em
      END,
      validado_por = v_validador_profile,
      validado_em = v_now,
      observacao = COALESCE(EXCLUDED.observacao, public.roleta_presencas.observacao);

    IF p_status = 'saiu' THEN
      UPDATE public.roleta_fila
         SET ativo = false
       WHERE corretor_id = v_profile_id
         AND data = p_data
         AND janela = v_turno
         AND ativo = true;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT * FROM public.roleta_presencas
     WHERE corretor_id = v_profile_id AND data = p_data AND turno = ANY(v_turnos_norm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.roleta_marcar_presenca(UUID, DATE, TEXT[], TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.roleta_fechar_dia(p_data DATE DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data DATE := COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_count INTEGER := 0;
BEGIN
  INSERT INTO public.roleta_presencas(corretor_id, data, turno, status, validado_em, observacao)
  SELECT DISTINCT
    rc.corretor_id,
    rc.data,
    t.turno,
    'falta',
    now(),
    'Falta automática pelo fechamento do dia'
  FROM public.roleta_credenciamentos rc
  CROSS JOIN LATERAL (
    SELECT unnest(
      CASE WHEN rc.janela = 'dia_todo' THEN ARRAY['manha','tarde']
           ELSE ARRAY[rc.janela] END
    ) AS turno
  ) t
  WHERE rc.data = v_data
    AND rc.status = 'aprovado'
    AND rc.corretor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.roleta_presencas rp
       WHERE rp.corretor_id = rc.corretor_id
         AND rp.data = rc.data
         AND rp.turno = t.turno
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.roleta_fechar_dia(DATE) TO service_role;

INSERT INTO public.roleta_config(chave, valor, descricao) VALUES
  ('presencas_minimas_domingo', '4', 'Presenças validadas seg-sáb necessárias para participar da roleta de domingo'),
  ('noturna_exige_manha_tarde', 'true', 'Se true, roleta noturna exige presença validada em manhã E tarde do mesmo dia')
ON CONFLICT (chave) DO NOTHING;

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
  v_descartes_mes         INTEGER;
  v_bloqueado_descarte    BOOLEAN;
  v_visitas_semana        INTEGER;
  v_pode_domingo          BOOLEAN;
  v_limite_leads          INTEGER;
  v_limite_descartes      INTEGER;
  v_visitas_min_domingo   INTEGER;
  v_presencas_min_domingo INTEGER;
  v_monday_date           DATE;
  v_saturday_date         DATE;
  v_today_brt             DATE;
  v_profile_id            UUID;
  v_desbloqueio_manual    BOOLEAN;
  v_presente_manha        BOOLEAN;
  v_presente_tarde        BOOLEAN;
  v_presencas_semana      INTEGER;
  v_noturna_exige         BOOLEAN;
BEGIN
  v_leads_desatualizados := public.contar_leads_desatualizados(p_corretor_id);

  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10)
    INTO v_limite_leads;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 50)
    INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'visitas_minimas_domingo'), 2)
    INTO v_visitas_min_domingo;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'presencas_minimas_domingo'), 4)
    INTO v_presencas_min_domingo;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'noturna_exige_manha_tarde'), true)
    INTO v_noturna_exige;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_corretor_id
  LIMIT 1;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_corretor_id))
    AND COALESCE(ps.tipo, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (
    SELECT 1 FROM public.roleta_desbloqueios
    WHERE corretor_id = p_corretor_id
      AND mes = to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO v_desbloqueio_manual;

  v_bloqueado_descarte := v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio_manual;
  v_pode_roleta_geral  := v_leads_desatualizados <= v_limite_leads AND NOT v_bloqueado_descarte;

  v_today_brt := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_atividades pa
    WHERE pa.responsavel_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today_brt
    UNION ALL
    SELECT 1
    FROM public.visitas v
    WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
      AND v.data_visita >= v_today_brt
      AND v.status IN ('marcada','confirmada','reagendada','realizada')
    LIMIT 1
  ) INTO v_tem_visita_hoje;

  SELECT
    EXISTS(SELECT 1 FROM public.roleta_presencas rp
            WHERE rp.corretor_id = v_profile_id
              AND rp.data = v_today_brt
              AND rp.turno = 'manha'
              AND rp.status IN ('na_empresa','saiu')),
    EXISTS(SELECT 1 FROM public.roleta_presencas rp
            WHERE rp.corretor_id = v_profile_id
              AND rp.data = v_today_brt
              AND rp.turno = 'tarde'
              AND rp.status IN ('na_empresa','saiu'))
  INTO v_presente_manha, v_presente_tarde;

  v_pode_roleta_noturna := v_pode_roleta_geral
    AND v_tem_visita_hoje
    AND (
      NOT v_noturna_exige
      OR (v_presente_manha AND v_presente_tarde)
    );

  v_monday_date := v_today_brt - ((EXTRACT(DOW FROM v_today_brt)::INTEGER + 6) % 7);
  v_saturday_date := v_monday_date + 5;

  SELECT COUNT(*)::INTEGER INTO v_visitas_semana
  FROM public.visitas v
  WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
    AND v.status = 'realizada'
    AND v.data_visita >= v_monday_date
    AND v.data_visita <= v_saturday_date;

  SELECT COUNT(DISTINCT rp.data)::INTEGER INTO v_presencas_semana
  FROM public.roleta_presencas rp
  WHERE rp.corretor_id = v_profile_id
    AND rp.data >= v_monday_date
    AND rp.data <= v_saturday_date
    AND rp.status IN ('na_empresa','saiu');

  v_pode_domingo := v_pode_roleta_geral
    AND v_visitas_semana >= v_visitas_min_domingo
    AND v_presencas_semana >= v_presencas_min_domingo;

  RETURN json_build_object(
    'leads_desatualizados', v_leads_desatualizados,
    'limite_bloqueio', v_limite_leads,
    'faltam_para_bloquear', GREATEST(0, v_limite_leads - v_leads_desatualizados),
    'pode_entrar_roleta', v_pode_roleta_geral,
    'tem_visita_hoje', v_tem_visita_hoje,
    'pode_roleta_noturna', v_pode_roleta_noturna,
    'pode_roleta_manha', v_pode_roleta_geral,
    'pode_roleta_tarde', v_pode_roleta_geral,
    'descartes_mes', v_descartes_mes,
    'limite_descartes', v_limite_descartes,
    'bloqueado_descarte', v_bloqueado_descarte,
    'desbloqueio_manual', v_desbloqueio_manual,
    'visitas_semana', v_visitas_semana,
    'pode_domingo', v_pode_domingo,
    'visitas_min_domingo', v_visitas_min_domingo,
    'presente_manha_hoje', v_presente_manha,
    'presente_tarde_hoje', v_presente_tarde,
    'presencas_semana', v_presencas_semana,
    'presencas_minimas_domingo', v_presencas_min_domingo,
    'noturna_exige_manha_tarde', v_noturna_exige,
    'leads_para_atualizar', '[]'::json
  );
END;
$$;
