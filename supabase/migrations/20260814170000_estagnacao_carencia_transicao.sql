-- CARÊNCIA ÚNICA DE TRANSIÇÃO da estagnação (14/08/2026).
-- Contexto: ao alinhar estagnação à nova saúde (régua crua por atividade), 99 leads
-- de 16 corretores que TINHAM tarefa futura agendada estagnaram de uma vez e sumiram
-- do board — o corretor "perdeu" leads que estava gerenciando, sem ter tido prazo.
-- Decisão do Lucas: NÃO mudar a régua (atividade segue sendo a verdade), só reparar a
-- virada com uma carência pontual que EXPIRA sozinha. Enquanto hoje <= carência, o lead
-- não estagna (vira 'ambar'): volta pro board/fila do corretor, sai da fila de resgate do
-- gerente, conta como ativo. O último toque REAL não é tocado (não mente na história).

-- 1) Coluna (NULL = sem carência p/ todo mundo; régua crua normal)
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS estagnacao_carencia_ate date;
COMMENT ON COLUMN public.pipeline_leads.estagnacao_carencia_ate IS
  'Carência ÚNICA de transição (14/08/2026): enquanto hoje <= esta data, o lead não conta como estagnado (vira atenção/amarelo), mesmo passando do prazo. Reparação da virada da régua de estagnação p/ não penalizar quem tinha tarefa futura. NULL = sem carência (regra crua normal). Expira sozinha.';

-- 2) Régua de 4 args = igual à de 3 args + carência (estagnaria mas em carência → 'ambar').
--    Espelhada em TS por src/lib/leadSaude.ts.
CREATE OR REPLACE FUNCTION public.lead_saude_status(p_ultimo_toque timestamptz, p_ref timestamptz, p_stage_tipo text, p_carencia_ate date)
 RETURNS text LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT CASE p_stage_tipo
      WHEN 'novo_lead' THEN 1 WHEN 'sem_contato' THEN 2
      WHEN 'qualificacao' THEN 7 WHEN 'aquecimento' THEN 15
      WHEN 'visita' THEN 2 WHEN 'proposta' THEN 7 WHEN 'contrato_gerado' THEN 7
      ELSE 7 END AS prazo,
      CASE p_stage_tipo
      WHEN 'sem_contato' THEN 15 WHEN 'qualificacao' THEN 21 WHEN 'aquecimento' THEN 21
      ELSE NULL END AS estagna),
  d AS (
    SELECT EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'America/Sao_Paulo')
             - (COALESCE(p_ultimo_toque, p_ref) AT TIME ZONE 'America/Sao_Paulo')))/86400.0 AS dias, prazo, estagna FROM cfg)
  SELECT CASE
    WHEN p_stage_tipo IN ('venda','caiu','descarte','convertido') THEN 'terminal'
    WHEN estagna IS NOT NULL AND dias > estagna THEN
      CASE WHEN p_carencia_ate IS NOT NULL AND p_carencia_ate >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
           THEN 'ambar' ELSE 'estagnado' END
    WHEN dias <= prazo THEN 'verde'
    WHEN dias <= prazo*2 THEN 'ambar'
    ELSE 'vermelho' END FROM d;
$function$;
GRANT EXECUTE ON FUNCTION public.lead_saude_status(timestamptz,timestamptz,text,date) TO authenticated;

-- 3) Backfill único: estagnado por saúde HOJE + com tarefa futura pendente → carência +14 dias.
UPDATE public.pipeline_leads pl
SET estagnacao_carencia_ate = (now() AT TIME ZONE 'America/Sao_Paulo')::date + 14
FROM public.pipeline_stages s
WHERE s.id = pl.stage_id
  AND s.tipo IN ('sem_contato','qualificacao','aquecimento')
  AND COALESCE(pl.arquivado,false)=false AND pl.negocio_id IS NULL AND COALESCE(pl.modulo_atual,'')<>'pos_vendas'
  AND public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), s.tipo)='estagnado'
  AND EXISTS (SELECT 1 FROM public.pipeline_tarefas t
              WHERE t.pipeline_lead_id=pl.id AND t.concluida_em IS NULL AND COALESCE(t.status,'')<>'concluida'
                AND t.vence_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
  AND pl.estagnacao_carencia_ate IS NULL;

-- 4) Consumidores passam a coluna de carência (get_pipeline_estagnacao + rpc_carteira_saude
--    aqui; get_dashboard_gerente_cockpit e get_pipeline_equipes_overview foram atualizados
--    in-place no mesmo commit para passar pl.estagnacao_carencia_ate à régua de 4 args).
CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()
 RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, corretor_id uuid, corretor_nome text, dias_limite integer, ultima_acao_humana timestamptz, dias_sem_acao integer, categoria text, estagnado_prazo_em timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT pl.id, pl.nome, pl.empreendimento, s.nome, pl.stage_id, pl.corretor_id, pr.nome,
    CASE s.tipo WHEN 'sem_contato' THEN 15 ELSE 21 END AS dias_limite,
    pl.ultimo_toque_at AS ultima_acao_humana,
    floor(extract(epoch FROM (now() - COALESCE(pl.ultimo_toque_at, pl.distribuido_em, pl.created_at)))/86400)::int AS dias_sem_acao,
    CASE
      WHEN EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa') THEN 'em_parceria'
      ELSE 'estagnado'
    END AS categoria,
    pl.estagnado_prazo_em
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  LEFT JOIN profiles pr ON pr.user_id = pl.corretor_id
  WHERE s.tipo IN ('sem_contato','qualificacao','aquecimento')
    AND COALESCE(pl.arquivado,false) = false
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), s.tipo, pl.estagnacao_carencia_ate) = 'estagnado'
    AND (
      public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
      OR (public.has_role(auth.uid(),'gestor') AND pl.corretor_id IN (
            SELECT tm.user_id FROM public.team_members tm WHERE tm.gerente_id = auth.uid() AND tm.status='ativo'))
    )
  ORDER BY dias_sem_acao DESC;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_carteira_saude(p_gerente_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_is_admin boolean; v_is_gestor boolean;
  v_gerente uuid := p_gerente_id; v_user uuid := p_user_id; v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  v_is_admin := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor');
  v_is_gestor := public.has_role(v_uid,'gestor');
  IF NOT v_is_admin THEN
    IF v_is_gestor THEN v_gerente := v_uid; v_user := NULL;
    ELSE v_user := v_uid; v_gerente := NULL; END IF;
  END IF;
  WITH team AS (
    SELECT user_id FROM public.team_members
    WHERE status='ativo' AND (v_gerente IS NULL OR gerente_id = v_gerente)),
  base AS (
    SELECT public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), st.tipo, pl.estagnacao_carencia_ate) AS saude
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages st ON st.id = pl.stage_id
    WHERE COALESCE(pl.arquivado,false)=false AND st.pipeline_tipo='leads'
      AND st.tipo NOT IN ('venda','caiu','descarte','convertido')
      AND ((v_user IS NOT NULL AND pl.corretor_id = v_user)
           OR (v_user IS NULL AND pl.corretor_id IN (SELECT user_id FROM team))))
  SELECT jsonb_build_object(
    'total', count(*),
    'ativos', count(*) FILTER (WHERE saude <> 'estagnado'),
    'em_dia', count(*) FILTER (WHERE saude='verde'),
    'atencao', count(*) FILTER (WHERE saude='ambar'),
    'desatualizado', count(*) FILTER (WHERE saude='vermelho'),
    'estagnado', count(*) FILTER (WHERE saude='estagnado'),
    'pct_em_dia', round(100.0*count(*) FILTER (WHERE saude='verde')/NULLIF(count(*) FILTER (WHERE saude<>'estagnado'),0),1)
  ) INTO v_res FROM base;
  RETURN COALESCE(v_res,'{}'::jsonb);
END $function$;
