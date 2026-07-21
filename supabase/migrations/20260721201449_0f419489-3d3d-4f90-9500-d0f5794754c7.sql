
-- ============================================================
-- FASE 2 — Alocação de Corretores + View de Performance
-- ============================================================

-- 1) Tabela corretor_alocacao
CREATE TABLE public.corretor_alocacao (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empreendimentos UUID[] NOT NULL DEFAULT '{}',
  observacao TEXT,
  atualizado_por UUID REFERENCES auth.users(id),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretor_alocacao TO authenticated;
GRANT ALL ON public.corretor_alocacao TO service_role;

ALTER TABLE public.corretor_alocacao ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado (o frontend precisa saber quem atende o quê)
CREATE POLICY "alocacao_read_authenticated" ON public.corretor_alocacao
  FOR SELECT TO authenticated USING (true);

-- Escrita direta: bloqueada. Só via RPC set_corretor_alocacao (SECURITY DEFINER).
CREATE POLICY "alocacao_write_admin" ON public.corretor_alocacao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_corretor_alocacao_empreendimentos
  ON public.corretor_alocacao USING GIN (empreendimentos);

-- 2) RPC: set_corretor_alocacao
CREATE OR REPLACE FUNCTION public.set_corretor_alocacao(
  p_user_id UUID,
  p_empreendimentos UUID[],
  p_observacao TEXT DEFAULT NULL
) RETURNS public.corretor_alocacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_is_gestor BOOLEAN;
  v_is_diretor BOOLEAN;
  v_in_team BOOLEAN;
  v_row public.corretor_alocacao;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_is_admin   := public.has_role(v_caller, 'admin'::app_role);
  v_is_gestor  := public.has_role(v_caller, 'gestor'::app_role);
  v_is_diretor := public.has_role(v_caller, 'diretor'::app_role);

  IF NOT (v_is_admin OR v_is_gestor OR v_is_diretor) THEN
    RAISE EXCEPTION 'forbidden: caller has no management role';
  END IF;

  -- Gestor só pode alocar corretores da própria equipe
  IF v_is_gestor AND NOT (v_is_admin OR v_is_diretor) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.team_members
      WHERE user_id = p_user_id AND gerente_id = v_caller AND status = 'ativo'
    ) INTO v_in_team;
    IF NOT v_in_team THEN
      RAISE EXCEPTION 'forbidden: user not in caller team';
    END IF;
  END IF;

  -- Validação: empreendimentos precisam existir e estar ativos
  IF p_empreendimentos IS NOT NULL AND array_length(p_empreendimentos, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_empreendimentos) e
      WHERE NOT EXISTS (
        SELECT 1 FROM public.empreendimentos_canonicos c
        WHERE c.id = e AND c.ativo = true
      )
    ) THEN
      RAISE EXCEPTION 'invalid empreendimento_id in list';
    END IF;
  END IF;

  INSERT INTO public.corretor_alocacao (user_id, empreendimentos, observacao, atualizado_por, atualizado_em)
  VALUES (p_user_id, COALESCE(p_empreendimentos, '{}'), p_observacao, v_caller, now())
  ON CONFLICT (user_id) DO UPDATE
    SET empreendimentos = EXCLUDED.empreendimentos,
        observacao      = EXCLUDED.observacao,
        atualizado_por  = EXCLUDED.atualizado_por,
        atualizado_em   = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_corretor_alocacao(UUID, UUID[], TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.set_corretor_alocacao(UUID, UUID[], TEXT) TO authenticated;

-- 3) View de performance corretor × empreendimento (agregada por dia)
CREATE OR REPLACE VIEW public.v_corretor_empreendimento_performance AS
WITH leads AS (
  SELECT
    pl.corretor_id AS auth_user_id,
    pl.empreendimento_canonico_id AS empreendimento_id,
    (pl.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
    COUNT(*)::int AS leads_recebidos
  FROM public.pipeline_leads pl
  WHERE pl.corretor_id IS NOT NULL
  GROUP BY 1, 2, 3
),
vis AS (
  SELECT
    v.corretor_id AS auth_user_id,
    ec.id AS empreendimento_id,
    v.data_visita AS dia,
    COUNT(*) FILTER (WHERE v.status IN ('marcada','realizada','no_show','remarcada','cancelada'))::int AS visitas_agendadas,
    COUNT(*) FILTER (WHERE v.status = 'realizada')::int AS visitas_realizadas,
    COUNT(*) FILTER (WHERE v.status = 'no_show')::int AS no_shows
  FROM public.visitas v
  LEFT JOIN public.pipeline_leads pl ON pl.id = v.pipeline_lead_id
  LEFT JOIN public.empreendimentos_canonicos ec ON ec.id = pl.empreendimento_canonico_id
  WHERE v.corretor_id IS NOT NULL
  GROUP BY 1, 2, 3
),
vend AS (
  SELECT
    n.auth_user_id,
    pl.empreendimento_canonico_id AS empreendimento_id,
    (COALESCE(n.data_assinatura::timestamptz, n.fase_changed_at) AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
    COUNT(*)::int AS vendas,
    COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0)::numeric AS vgv
  FROM public.negocios n
  LEFT JOIN public.pipeline_leads pl ON pl.id = n.pipeline_lead_id
  WHERE n.fase = 'vendido' AND n.auth_user_id IS NOT NULL
  GROUP BY 1, 2, 3
)
SELECT
  COALESCE(l.auth_user_id, v.auth_user_id, s.auth_user_id) AS auth_user_id,
  COALESCE(l.empreendimento_id, v.empreendimento_id, s.empreendimento_id) AS empreendimento_id,
  COALESCE(l.dia, v.dia, s.dia) AS dia,
  COALESCE(l.leads_recebidos, 0) AS leads_recebidos,
  COALESCE(v.visitas_agendadas, 0) AS visitas_agendadas,
  COALESCE(v.visitas_realizadas, 0) AS visitas_realizadas,
  COALESCE(v.no_shows, 0) AS no_shows,
  COALESCE(s.vendas, 0) AS vendas,
  COALESCE(s.vgv, 0) AS vgv
FROM leads l
FULL OUTER JOIN vis v
  ON v.auth_user_id = l.auth_user_id
 AND v.empreendimento_id IS NOT DISTINCT FROM l.empreendimento_id
 AND v.dia = l.dia
FULL OUTER JOIN vend s
  ON s.auth_user_id = COALESCE(l.auth_user_id, v.auth_user_id)
 AND s.empreendimento_id IS NOT DISTINCT FROM COALESCE(l.empreendimento_id, v.empreendimento_id)
 AND s.dia = COALESCE(l.dia, v.dia);

GRANT SELECT ON public.v_corretor_empreendimento_performance TO authenticated;
