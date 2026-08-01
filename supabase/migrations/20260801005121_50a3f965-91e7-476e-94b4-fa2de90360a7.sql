-- 1) Tabela de histórico de equipe
CREATE TABLE IF NOT EXISTS public.equipe_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_auth_id uuid NOT NULL,
  equipe text NOT NULL,
  gerente_auth_id uuid,
  vigencia_inicio date NOT NULL DEFAULT '2000-01-01',
  vigencia_fim date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipe_historico_corretor
  ON public.equipe_historico (corretor_auth_id, vigencia_inicio DESC);

GRANT SELECT ON public.equipe_historico TO authenticated;
GRANT ALL ON public.equipe_historico TO service_role;

ALTER TABLE public.equipe_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipe_historico_select" ON public.equipe_historico;
CREATE POLICY "equipe_historico_select" ON public.equipe_historico
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "equipe_historico_admin_write" ON public.equipe_historico;
CREATE POLICY "equipe_historico_admin_write" ON public.equipe_historico
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

DROP TRIGGER IF EXISTS trg_equipe_historico_updated_at ON public.equipe_historico;
CREATE TRIGGER trg_equipe_historico_updated_at
  BEFORE UPDATE ON public.equipe_historico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Resolver equipe na data (fallback = equipe atual)
CREATE OR REPLACE FUNCTION public.fn_equipe_na_data(p_corretor uuid, p_data date)
RETURNS TABLE(equipe text, gerente_auth_id uuid, corretor_ativo boolean, equipe_atual text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(h.equipe, ce.equipe),
         COALESCE(h.gerente_auth_id, ce.gerente_auth_id),
         COALESCE(ce.corretor_ativo, false),
         ce.equipe
  FROM (SELECT 1) x
  LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = p_corretor
  LEFT JOIN LATERAL (
    SELECT eh.equipe, eh.gerente_auth_id
    FROM public.equipe_historico eh
    WHERE eh.corretor_auth_id = p_corretor
      AND p_data IS NOT NULL
      AND eh.vigencia_inicio <= p_data
      AND (eh.vigencia_fim IS NULL OR p_data <= eh.vigencia_fim)
    ORDER BY eh.vigencia_inicio DESC
    LIMIT 1
  ) h ON true
  WHERE p_corretor IS NOT NULL
$$;

-- 3) Views de fato passam a resolver a equipe pela data do fato
DO $do$
DECLARE
  d text;
  novo text;
BEGIN
  -- v_fato_venda
  d := pg_get_viewdef('public.v_fato_venda', true);
  novo := replace(d,
    'LEFT JOIN v_corretor_equipe ce ON ce.corretor_auth_id = r.auth_id',
    'LEFT JOIN LATERAL public.fn_equipe_na_data(r.auth_id, g.data_assinatura) ce ON true');
  IF novo = d THEN RAISE EXCEPTION 'v_fato_venda: join de equipe nao encontrado'; END IF;
  EXECUTE 'CREATE OR REPLACE VIEW public.v_fato_venda AS ' || novo;

  -- v_fato_visita
  d := pg_get_viewdef('public.v_fato_visita', true);
  novo := replace(d,
    'LEFT JOIN v_corretor_equipe ce ON ce.corretor_auth_id = COALESCE(p_auth.user_id, p_prof.user_id)',
    'LEFT JOIN LATERAL public.fn_equipe_na_data(COALESCE(p_auth.user_id, p_prof.user_id), v.data_visita) ce ON true');
  IF novo = d THEN RAISE EXCEPTION 'v_fato_visita: join de equipe nao encontrado'; END IF;
  EXECUTE 'CREATE OR REPLACE VIEW public.v_fato_visita AS ' || novo;

  -- v_fato_lead
  d := pg_get_viewdef('public.v_fato_lead', true);
  novo := replace(d,
    'LEFT JOIN v_corretor_equipe ce ON ce.corretor_auth_id = l.corretor_id',
    'LEFT JOIN LATERAL public.fn_equipe_na_data(l.corretor_id, ((l.created_at AT TIME ZONE ''America/Sao_Paulo''::text)::date)) ce ON true');
  IF novo = d THEN RAISE EXCEPTION 'v_fato_lead: join de equipe nao encontrado'; END IF;
  EXECUTE 'CREATE OR REPLACE VIEW public.v_fato_lead AS ' || novo;
END
$do$;

-- 4) rpc_metricas: linha por (corretor, equipe da epoca) + equipe atual
DROP FUNCTION IF EXISTS public.rpc_metricas(date, date, uuid, uuid, boolean);

CREATE FUNCTION public.rpc_metricas(
  p_start date,
  p_end date,
  p_user_id uuid DEFAULT NULL,
  p_gerente_id uuid DEFAULT NULL,
  p_incluir_inativos boolean DEFAULT true
)
RETURNS TABLE(
  corretor_auth_id uuid,
  corretor_nome text,
  equipe text,
  equipe_atual text,
  gerente_auth_id uuid,
  corretor_ativo boolean,
  leads_recebidos bigint,
  visitas_marcadas bigint,
  visitas_agendadas bigint,
  visitas_a_realizar bigint,
  visitas_realizadas bigint,
  visitas_no_show bigint,
  vendas numeric,
  vgv_assinado numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH vendas AS (
    SELECT v.corretor_auth_id, v.equipe,
           SUM(v.participacao) AS vendas,
           SUM(v.vgv_rateado)  AS vgv_assinado
    FROM public.v_fato_venda v
    WHERE v.data_assinatura >= p_start
      AND v.data_assinatura <= p_end
      AND v.corretor_auth_id IS NOT NULL
    GROUP BY v.corretor_auth_id, v.equipe
  ),
  visitas AS (
    SELECT vi.corretor_auth_id, vi.equipe,
           COUNT(*) FILTER (WHERE vi.conta_marcada    AND vi.data_criacao BETWEEN p_start AND p_end) AS visitas_agendadas,
           COUNT(*) FILTER (WHERE vi.conta_a_realizar AND vi.data_criacao BETWEEN p_start AND p_end) AS visitas_a_realizar,
           COUNT(*) FILTER (WHERE vi.conta_realizada  AND vi.data_visita  BETWEEN p_start AND p_end) AS visitas_realizadas,
           COUNT(*) FILTER (WHERE vi.conta_no_show    AND vi.data_visita  BETWEEN p_start AND p_end) AS visitas_no_show
    FROM public.v_fato_visita vi
    WHERE vi.corretor_auth_id IS NOT NULL
      AND (vi.data_criacao BETWEEN p_start AND p_end OR vi.data_visita BETWEEN p_start AND p_end)
    GROUP BY vi.corretor_auth_id, vi.equipe
  ),
  leads AS (
    SELECT l.corretor_auth_id, l.equipe, COUNT(*) AS leads_recebidos
    FROM public.v_fato_lead l
    WHERE l.data_entrada BETWEEN p_start AND p_end
      AND l.corretor_auth_id IS NOT NULL
    GROUP BY l.corretor_auth_id, l.equipe
  ),
  base AS (
    SELECT corretor_auth_id, equipe FROM vendas
    UNION SELECT corretor_auth_id, equipe FROM visitas
    UNION SELECT corretor_auth_id, equipe FROM leads
  )
  SELECT b.corretor_auth_id,
         pr.nome,
         b.equipe,
         ce.equipe,
         ce.gerente_auth_id,
         COALESCE(ce.corretor_ativo, false),
         COALESCE(l.leads_recebidos, 0),
         COALESCE(vi.visitas_agendadas, 0),
         COALESCE(vi.visitas_agendadas, 0),
         COALESCE(vi.visitas_a_realizar, 0),
         COALESCE(vi.visitas_realizadas, 0),
         COALESCE(vi.visitas_no_show, 0),
         COALESCE(ve.vendas, 0),
         COALESCE(ve.vgv_assinado, 0)
  FROM base b
  LEFT JOIN public.profiles pr ON pr.user_id = b.corretor_auth_id
  LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = b.corretor_auth_id
  LEFT JOIN vendas ve ON ve.corretor_auth_id = b.corretor_auth_id AND ve.equipe IS NOT DISTINCT FROM b.equipe
  LEFT JOIN visitas vi ON vi.corretor_auth_id = b.corretor_auth_id AND vi.equipe IS NOT DISTINCT FROM b.equipe
  LEFT JOIN leads l ON l.corretor_auth_id = b.corretor_auth_id AND l.equipe IS NOT DISTINCT FROM b.equipe
  WHERE (p_user_id IS NULL OR b.corretor_auth_id = p_user_id)
    AND (p_gerente_id IS NULL OR ce.gerente_auth_id = p_gerente_id)
    AND (p_incluir_inativos OR COALESCE(ce.corretor_ativo, false))
  ORDER BY COALESCE(ve.vgv_assinado, 0) DESC, COALESCE(vi.visitas_realizadas, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_metricas(date, date, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_equipe_na_data(uuid, date) TO authenticated;