-- =====================================================================
-- ONDA 1 — Segurança/Autorização (migration única)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Tabela de rollback (snapshots ANTES de qualquer alteração)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._rollback_onda1 (
  id bigserial PRIMARY KEY,
  objeto text NOT NULL,
  tipo text NOT NULL,
  definicao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public._rollback_onda1 TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public._rollback_onda1_id_seq TO service_role;
ALTER TABLE public._rollback_onda1 ENABLE ROW LEVEL SECURITY;
-- sem policies: tabela interna, apenas service_role

-- snapshot das 13 funções tocadas
INSERT INTO public._rollback_onda1 (objeto, tipo, definicao)
SELECT p.proname, 'function', pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'finalizar_tentativa_v2','fetch_next_lead','fetch_next_lead_campaign',
    'oferta_ativa_lock_next_lead','skip_oa_lead','aceitar_lead','rejeitar_lead',
    'lock_lead_atomic','renew_lead_lock','get_relatorio_origem_performance',
    'get_dashboard_gerente','get_dashboard_gerente_v4_kpis','get_dashboard_gerente_v4_dia'
  ]);

-- snapshot das policies tocadas
INSERT INTO public._rollback_onda1 (objeto, tipo, definicao)
SELECT tablename || ' :: ' || policyname,
       'policy',
       'cmd=' || cmd || ' roles=' || roles::text || ' USING (' || COALESCE(qual, '') || ')'
FROM pg_policies
WHERE (tablename = 'pagadoria_solicitacoes' AND policyname = 'Users can view own solicitacoes')
   OR (tablename = 'corretor_calendar_integrations' AND policyname = 'Corretor vê própria integração');

-- ---------------------------------------------------------------------
-- 1) Helper de autorização + guard nas 9 RPCs de ação
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_acts_as(p_corretor_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  -- chamadas internas (edge functions com service_role / crons)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;

  IF p_corretor_id = auth.uid()
     OR p_corretor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'forbidden';
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.assert_acts_as(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_acts_as(uuid) TO authenticated, service_role;

-- Insere `PERFORM public.assert_acts_as(p_corretor_id);` como primeira instrução,
-- preservando o corpo atual byte a byte (obtido de pg_get_functiondef).
DO $mig$
DECLARE
  r record;
  v_def text;
  v_new text;
  v_pos int;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'finalizar_tentativa_v2','fetch_next_lead','fetch_next_lead_campaign',
        'oferta_ativa_lock_next_lead','skip_oa_lead','aceitar_lead','rejeitar_lead',
        'lock_lead_atomic','renew_lead_lock'
      ])
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_pos := position(E'\nBEGIN\n' IN v_def);
    IF v_pos = 0 THEN
      RAISE EXCEPTION 'padrao BEGIN nao encontrado em %', r.proname;
    END IF;

    v_new := overlay(
      v_def
      PLACING E'\nBEGIN\n  PERFORM public.assert_acts_as(p_corretor_id);\n'
      FROM v_pos FOR 7
    );

    -- skip_oa_lead: admin deve ser aferido pelo chamador, não pelo id recebido
    IF r.proname = 'skip_oa_lead' THEN
      v_new := replace(
        v_new,
        'NOT has_role(p_corretor_id, ''admin'')',
        'NOT public.has_role(auth.uid(), ''admin''::app_role)'
      );
    END IF;

    EXECUTE v_new;
  END LOOP;
END;
$mig$;

-- Retira execução anônima das 9 RPCs de ação
DO $grants$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'finalizar_tentativa_v2','fetch_next_lead','fetch_next_lead_campaign',
        'oferta_ativa_lock_next_lead','skip_oa_lead','aceitar_lead','rejeitar_lead',
        'lock_lead_atomic','renew_lead_lock'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
  END LOOP;
END;
$grants$;

-- ---------------------------------------------------------------------
-- 2) get_relatorio_origem_performance — escopo por papel
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_relatorio_origem_performance(
  p_start date,
  p_end date,
  p_corretor_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(lead_id uuid, nome text, created_at timestamp with time zone, origem text, campanha text, conjunto_anuncio text, anuncio text, plataforma text, empreendimento text, corretor_id uuid, corretor_nome text, stage_nome text, stage_ordem integer, motivo_descarte text, tipo_descarte text, primeiro_contato_em timestamp with time zone, primeiro_contato_em_v1 timestamp with time zone, origem_primeiro_contato text, tempo_ate_primeiro_contato_min integer, tem_visita_realizada boolean, tem_venda boolean, vgv numeric, teve_contato_v3 boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
#variable_conflict use_column
DECLARE
  v_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'diretor'::app_role) THEN
    v_ids := p_corretor_ids;                    -- comportamento atual: NULL = todos
  ELSE
    SELECT array_agg(rmb.user_id) INTO v_ids
    FROM public.resolve_managed_brokers(auth.uid()) rmb;

    v_ids := COALESCE(v_ids, ARRAY[]::uuid[]) || auth.uid();

    IF p_corretor_ids IS NOT NULL THEN
      SELECT COALESCE(array_agg(x), ARRAY[]::uuid[]) INTO v_ids
      FROM unnest(v_ids) x
      WHERE x = ANY (p_corretor_ids);
    END IF;
  END IF;

  RETURN QUERY
  SELECT pl.id, pl.nome, pl.created_at, pl.origem, pl.campanha, pl.conjunto_anuncio,
    pl.anuncio, pl.plataforma, pl.empreendimento, pl.corretor_id,
    p.nome, st.nome, st.ordem, pl.motivo_descarte, pl.tipo_descarte,
    pc.t, pl.primeiro_contato_em,
    CASE WHEN pc.origem_tag IS NOT NULL THEN pc.origem_tag
         WHEN st.ordem >= 1 AND st.ordem <= 7 THEN 'mudanca_etapa' ELSE NULL END,
    CASE WHEN pc.t IS NOT NULL THEN GREATEST(0, round(extract(epoch FROM (pc.t - pl.created_at))/60))::int ELSE NULL END,
    COALESCE(v.tem_visita, false), COALESCE(n.tem_venda, false), COALESCE(n.vgv, 0),
    (pc.t IS NOT NULL OR (st.ordem >= 1 AND st.ordem <= 7))
  FROM pipeline_leads pl
  LEFT JOIN profiles p ON p.user_id = pl.corretor_id
  LEFT JOIN pipeline_stages st ON st.id = pl.stage_id
  LEFT JOIN LATERAL (SELECT t, origem_tag FROM (
      SELECT min(w.timestamp) AS t, 'whatsapp'::text AS origem_tag FROM whatsapp_mensagens w
       WHERE w.lead_id = pl.id AND w.direction IN ('sent','out')
      UNION ALL
      SELECT min(a.created_at) AS t, 'atividade'::text AS origem_tag FROM pipeline_atividades a
       WHERE a.pipeline_lead_id = pl.id
         AND (a.tipo IN ('whatsapp','ligacao','contato','mensagem','email','visita','reuniao','proposta','nao_atendeu') OR a.tipo_contato IS NOT NULL)
    ) s WHERE t IS NOT NULL ORDER BY t ASC LIMIT 1) pc ON true
  LEFT JOIN LATERAL (SELECT true AS tem_visita FROM visitas vi WHERE vi.pipeline_lead_id = pl.id AND vi.status = 'realizada' LIMIT 1) v ON true
  LEFT JOIN LATERAL (SELECT (count(*) > 0) AS tem_venda,
      sum(COALESCE(ng.vgv_final, ng.vgv_estimado, 0)) AS vgv
      FROM negocios ng WHERE ng.pipeline_lead_id = pl.id AND ng.fase = 'ganho') n ON true
  WHERE pl.created_at::date >= p_start AND pl.created_at::date <= p_end
    AND (v_ids IS NULL OR pl.corretor_id = ANY (v_ids));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_relatorio_origem_performance(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_relatorio_origem_performance(date, date, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Policy SELECT de pagadoria_solicitacoes (bridge correto de ids)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own solicitacoes" ON public.pagadoria_solicitacoes;

CREATE POLICY "Users can view own solicitacoes"
ON public.pagadoria_solicitacoes
FOR SELECT
TO authenticated
USING (
  solicitante_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'backoffice'::app_role)
  OR public.can_access_negocio(pagadoria_solicitacoes.negocio_id)
);

-- ---------------------------------------------------------------------
-- 4) Diretor liberado nos dashboards do gerente
-- ---------------------------------------------------------------------
DO $dash$
DECLARE
  r record;
  v_def text;
  v_new text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_dashboard_gerente','get_dashboard_gerente_v4_kpis','get_dashboard_gerente_v4_dia'
      ])
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(
      v_def,
      'AND NOT public.has_role(auth.uid(), ''admin'')',
      'AND NOT (public.has_role(auth.uid(), ''admin''::app_role) OR public.has_role(auth.uid(), ''diretor''::app_role))'
    );
    IF v_new = v_def THEN
      RAISE EXCEPTION 'guard nao encontrado em %', r.proname;
    END IF;
    EXECUTE v_new;
  END LOOP;
END;
$dash$;

-- ---------------------------------------------------------------------
-- 5) corretor_calendar_integrations — cliente sem acesso aos tokens
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Corretor vê própria integração" ON public.corretor_calendar_integrations;

CREATE OR REPLACE FUNCTION public.get_my_calendar_integration()
RETURNS TABLE(account_email text, status text, connected_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT c.account_email, c.status, c.connected_at
  FROM public.corretor_calendar_integrations c
  WHERE c.corretor_id = auth.uid()
    AND c.provider = 'google'
  LIMIT 1;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_my_calendar_integration() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_calendar_integration() TO authenticated, service_role;