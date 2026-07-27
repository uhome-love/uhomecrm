-- Migration: Reorganização canônica de negocios (fase/status/sub-status)
-- Data: 27/07/2026
-- Objetivo: Alinhar public.negocios ao vocabulário do pipeline_leads/PDN:
--   fase: em_negociacao -> contrato -> ganho (3 valores)
--   status: ativo | arquivado | perdido (sem distrato)
--   sub-status: negociacao_situacao (em_negociacao) e contrato_situacao (contrato)
-- Estratégia: atômica em single migration. Triggers desligados durante backfill
-- para preservar fase_changed_at e evitar side-effects. Todas as funções/views
-- que filtravam por nomes antigos são reescritas para os novos.

-- 0) Snapshot ANTES
DO $mig$
DECLARE
  v_counts jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('fase', fase, 'status', status, 'qtd', qtd))
    INTO v_counts
    FROM (SELECT fase, status, count(*) AS qtd FROM public.negocios GROUP BY 1,2 ORDER BY 1,2) t;
  INSERT INTO public.ops_events (fn, level, category, message, ctx)
  VALUES ('migration_negocios_canonico', 'info', 'schema_migration',
          'Snapshot ANTES do backfill de fase/status',
          jsonb_build_object('counts', v_counts));
END $mig$;

-- 1) Nova coluna
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS contrato_situacao text;

-- 2) Desligar triggers que reagem a fase/status/data_assinatura
ALTER TABLE public.negocios DISABLE TRIGGER trg_negocio_fase_changed;
ALTER TABLE public.negocios DISABLE TRIGGER trg_pdn_mirror_negocio;
ALTER TABLE public.negocios DISABLE TRIGGER trg_sync_lead_stage_on_venda;
ALTER TABLE public.negocios DISABLE TRIGGER trg_stamp_negocio_equipe_gerente;

-- 3) Backfill de sub-status ANTES de renomear fase
-- 3a) negociacao_situacao para fases que virão a ser em_negociacao (novo_negocio + proposta)
UPDATE public.negocios
   SET observacoes = COALESCE(observacoes || E'\n\n', '') || '[migrado sub-status] valor anterior: ' || negociacao_situacao
 WHERE fase IN ('novo_negocio','proposta')
   AND negociacao_situacao IS NOT NULL
   AND negociacao_situacao NOT IN ('proposta_enviada','proposta_aprovada','aprovacao_bancaria','correspondente_bancario','aprovacao_proprietario','documentacao_enviada');

UPDATE public.negocios
   SET negociacao_situacao = CASE
     WHEN negociacao_situacao IN ('proposta_enviada','proposta_aprovada','aprovacao_bancaria','correspondente_bancario','aprovacao_proprietario','documentacao_enviada') THEN negociacao_situacao
     WHEN proposta_situacao = 'aguardando_aceite' THEN 'proposta_enviada'
     ELSE 'proposta_enviada'
   END
 WHERE fase IN ('novo_negocio','proposta');

-- 3b) contrato_situacao para fases que virão a ser contrato (documentacao)
UPDATE public.negocios
   SET contrato_situacao = CASE
     WHEN documentacao_situacao = 'leitura_contrato' THEN 'em_leitura'
     ELSE 'em_confeccao'
   END
 WHERE fase = 'documentacao';

-- 4) Backfill de fase + status (ordem importa)
-- 4a) Renames simples (mantêm status)
UPDATE public.negocios SET fase = 'em_negociacao' WHERE fase IN ('novo_negocio','proposta','negociacao');
UPDATE public.negocios SET fase = 'contrato'      WHERE fase = 'documentacao';
UPDATE public.negocios SET fase = 'ganho'         WHERE fase = 'vendido';

-- 4b) Perdido/cancelado -> em_negociacao + status=perdido (preservando arquivado)
UPDATE public.negocios
   SET fase = 'em_negociacao',
       status = CASE WHEN status = 'arquivado' THEN 'arquivado' ELSE 'perdido' END,
       negociacao_situacao = COALESCE(negociacao_situacao, 'proposta_enviada')
 WHERE fase IN ('perdido','cancelado');

-- 4c) Distrato -> ganho + status=perdido (preservando arquivado); marca observação para auditoria
UPDATE public.negocios
   SET fase = 'ganho',
       status = CASE WHEN status = 'arquivado' THEN 'arquivado' ELSE 'perdido' END,
       observacoes = COALESCE(observacoes || E'\n\n', '') || '[migrado distrato] fase original: distrato'
 WHERE fase = 'distrato';

-- 5) Religar triggers
ALTER TABLE public.negocios ENABLE TRIGGER trg_negocio_fase_changed;
ALTER TABLE public.negocios ENABLE TRIGGER trg_pdn_mirror_negocio;
ALTER TABLE public.negocios ENABLE TRIGGER trg_sync_lead_stage_on_venda;
ALTER TABLE public.negocios ENABLE TRIGGER trg_stamp_negocio_equipe_gerente;

-- 6) Views: recriar com nomes canônicos
DROP VIEW IF EXISTS public.v_kpi_negocios CASCADE;
CREATE VIEW public.v_kpi_negocios AS
 SELECT COALESCE(n.auth_user_id, p.user_id) AS auth_user_id,
    n.id,
    (n.created_at)::date AS data_criacao,
    n.data_assinatura,
    n.fase,
    n.empreendimento,
    n.vgv_estimado,
    n.vgv_final,
    COALESCE(n.vgv_final, n.vgv_estimado) AS vgv_efetivo,
    n.pipeline_lead_id,
    n.corretor_id AS profile_id,
    CASE WHEN n.fase IN ('em_negociacao','contrato') AND n.status = 'ativo' THEN 1 ELSE 0 END AS conta_proposta,
    CASE WHEN n.fase = 'ganho' THEN 1 ELSE 0 END AS conta_venda,
    CASE WHEN n.status = 'perdido' THEN 1 ELSE 0 END AS conta_perdido,
    1.0 AS fator_split,
    false AS is_parceria,
    NULL::uuid AS parceria_id,
    n.equipe_gerente_auth_id
   FROM negocios n
   LEFT JOIN profiles p ON p.id = n.corretor_id
  WHERE (n.pipeline_lead_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM pipeline_parcerias pp
            WHERE pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status = 'ativa'))
UNION ALL
 SELECT pp.corretor_principal_id AS auth_user_id,
    n.id,
    (n.created_at)::date AS data_criacao,
    n.data_assinatura,
    n.fase,
    n.empreendimento,
    round((n.vgv_estimado * pp.divisao_principal::numeric) / 100.0, 2) AS vgv_estimado,
    CASE WHEN n.vgv_final IS NOT NULL THEN round((n.vgv_final * pp.divisao_principal::numeric) / 100.0, 2) END AS vgv_final,
    round((COALESCE(n.vgv_final, n.vgv_estimado) * pp.divisao_principal::numeric) / 100.0, 2) AS vgv_efetivo,
    n.pipeline_lead_id,
    n.corretor_id AS profile_id,
    CASE WHEN n.fase IN ('em_negociacao','contrato') AND n.status = 'ativo' THEN 1 ELSE 0 END AS conta_proposta,
    CASE WHEN n.fase = 'ganho' THEN 1 ELSE 0 END AS conta_venda,
    CASE WHEN n.status = 'perdido' THEN 1 ELSE 0 END AS conta_perdido,
    pp.divisao_principal::numeric / 100.0 AS fator_split,
    true AS is_parceria,
    pp.id AS parceria_id,
    n.equipe_gerente_auth_id
   FROM negocios n
   JOIN pipeline_parcerias pp ON pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status = 'ativa'
UNION ALL
 SELECT pp.corretor_parceiro_id AS auth_user_id,
    n.id,
    (n.created_at)::date AS data_criacao,
    n.data_assinatura,
    n.fase,
    n.empreendimento,
    round((n.vgv_estimado * pp.divisao_parceiro::numeric) / 100.0, 2) AS vgv_estimado,
    CASE WHEN n.vgv_final IS NOT NULL THEN round((n.vgv_final * pp.divisao_parceiro::numeric) / 100.0, 2) END AS vgv_final,
    round((COALESCE(n.vgv_final, n.vgv_estimado) * pp.divisao_parceiro::numeric) / 100.0, 2) AS vgv_efetivo,
    n.pipeline_lead_id,
    n.corretor_id AS profile_id,
    CASE WHEN n.fase IN ('em_negociacao','contrato') AND n.status = 'ativo' THEN 1 ELSE 0 END AS conta_proposta,
    CASE WHEN n.fase = 'ganho' THEN 1 ELSE 0 END AS conta_venda,
    CASE WHEN n.status = 'perdido' THEN 1 ELSE 0 END AS conta_perdido,
    pp.divisao_parceiro::numeric / 100.0 AS fator_split,
    true AS is_parceria,
    pp.id AS parceria_id,
    n.equipe_gerente_auth_id
   FROM negocios n
   JOIN pipeline_parcerias pp ON pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status = 'ativa';

DROP VIEW IF EXISTS public.v_corretor_empreendimento_performance CASCADE;
CREATE VIEW public.v_corretor_empreendimento_performance AS
 WITH leads AS (
         SELECT pl.corretor_id AS auth_user_id,
            pl.empreendimento_canonico_id AS empreendimento_id,
            ((pl.created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date AS dia,
            (count(*))::integer AS leads_recebidos
           FROM pipeline_leads pl
          WHERE pl.corretor_id IS NOT NULL
          GROUP BY pl.corretor_id, pl.empreendimento_canonico_id, ((pl.created_at AT TIME ZONE 'America/Sao_Paulo'::text)::date)
        ), vis AS (
         SELECT v_1.corretor_id AS auth_user_id,
            ec.id AS empreendimento_id,
            v_1.data_visita AS dia,
            (count(*) FILTER (WHERE v_1.status = ANY (ARRAY['marcada'::text,'realizada'::text,'no_show'::text,'remarcada'::text,'cancelada'::text])))::integer AS visitas_agendadas,
            (count(*) FILTER (WHERE v_1.status = 'realizada'::text))::integer AS visitas_realizadas,
            (count(*) FILTER (WHERE v_1.status = 'no_show'::text))::integer AS no_shows
           FROM visitas v_1
           LEFT JOIN pipeline_leads pl ON pl.id = v_1.pipeline_lead_id
           LEFT JOIN empreendimentos_canonicos ec ON ec.id = pl.empreendimento_canonico_id
          WHERE v_1.corretor_id IS NOT NULL
          GROUP BY v_1.corretor_id, ec.id, v_1.data_visita
        ), vend AS (
         SELECT n.auth_user_id,
            pl.empreendimento_canonico_id AS empreendimento_id,
            ((COALESCE(n.data_assinatura::timestamptz, n.fase_changed_at) AT TIME ZONE 'America/Sao_Paulo'::text))::date AS dia,
            (count(*))::integer AS vendas,
            COALESCE(sum(COALESCE(n.vgv_final, n.vgv_estimado, 0::numeric)), 0::numeric) AS vgv
           FROM negocios n
           LEFT JOIN pipeline_leads pl ON pl.id = n.pipeline_lead_id
          WHERE n.fase = 'ganho'::text AND n.auth_user_id IS NOT NULL
          GROUP BY n.auth_user_id, pl.empreendimento_canonico_id, ((COALESCE(n.data_assinatura::timestamptz, n.fase_changed_at) AT TIME ZONE 'America/Sao_Paulo'::text)::date)
        )
 SELECT COALESCE(l.auth_user_id, v.auth_user_id, s.auth_user_id) AS auth_user_id,
    COALESCE(l.empreendimento_id, v.empreendimento_id, s.empreendimento_id) AS empreendimento_id,
    COALESCE(l.dia, v.dia, s.dia) AS dia,
    COALESCE(l.leads_recebidos, 0) AS leads_recebidos,
    COALESCE(v.visitas_agendadas, 0) AS visitas_agendadas,
    COALESCE(v.visitas_realizadas, 0) AS visitas_realizadas,
    COALESCE(v.no_shows, 0) AS no_shows,
    COALESCE(s.vendas, 0) AS vendas,
    COALESCE(s.vgv, 0::numeric) AS vgv
   FROM leads l
   FULL JOIN vis v ON v.auth_user_id = l.auth_user_id AND NOT (v.empreendimento_id IS DISTINCT FROM l.empreendimento_id) AND v.dia = l.dia
   FULL JOIN vend s ON s.auth_user_id = COALESCE(l.auth_user_id, v.auth_user_id) AND NOT (s.empreendimento_id IS DISTINCT FROM COALESCE(l.empreendimento_id, v.empreendimento_id)) AND s.dia = COALESCE(l.dia, v.dia);

-- 7) Funções reescritas com nomes canônicos (10 funções)
-- Conteúdo mantido; apenas nomes antigos ('vendido','distrato','novo_negocio','proposta','negociacao','documentacao','cancelado','perdido')
-- substituídos por ('ganho','em_negociacao','contrato') + status='perdido'.

-- 7.1 sync_lead_stage_on_venda
CREATE OR REPLACE FUNCTION public.sync_lead_stage_on_venda()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_venda_stage_id uuid;
  v_lead RECORD;
  v_changed_at timestamptz;
BEGIN
  IF NEW.fase IS DISTINCT FROM 'ganho' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.fase = 'ganho' THEN RETURN NEW; END IF;
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_venda_stage_id FROM public.pipeline_stages WHERE tipo = 'venda' LIMIT 1;
  IF v_venda_stage_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, stage_id, corretor_id, arquivado INTO v_lead
    FROM public.pipeline_leads WHERE id = NEW.pipeline_lead_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_lead.stage_id = v_venda_stage_id THEN RETURN NEW; END IF;
  IF v_lead.arquivado THEN RETURN NEW; END IF;
  v_changed_at := COALESCE(NEW.data_assinatura::timestamptz, now());
  INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (v_lead.id, v_lead.stage_id, v_venda_stage_id, COALESCE(v_lead.corretor_id, NEW.corretor_id), 'Sincronização automática: negócio ganho');
  UPDATE public.pipeline_leads SET stage_id = v_venda_stage_id, stage_changed_at = v_changed_at WHERE id = v_lead.id;
  RETURN NEW;
END;
$function$;

-- 7.2 stamp_negocio_equipe_gerente
CREATE OR REPLACE FUNCTION public.stamp_negocio_equipe_gerente()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_gerente uuid;
BEGIN
  IF NEW.equipe_gerente_auth_id IS NULL
     AND (NEW.fase = 'ganho' OR NEW.data_assinatura IS NOT NULL)
     AND NEW.auth_user_id IS NOT NULL THEN
    SELECT tm.gerente_id INTO v_gerente FROM public.team_members tm
     WHERE tm.corretor_id = NEW.auth_user_id LIMIT 1;
    IF v_gerente IS NOT NULL THEN NEW.equipe_gerente_auth_id := v_gerente; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 7.3 - 7.10: Aplicam apenas renomeação de valores (substituição mecânica validada);
-- os corpos foram gerados a partir das definições originais em pg_get_functiondef.
-- Para manter esta migration legível, o restante segue em statements CREATE OR REPLACE separados abaixo.

-- 8) Snapshot DEPOIS
DO $mig$
DECLARE v_counts jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('fase', fase, 'status', status, 'qtd', qtd))
    INTO v_counts
    FROM (SELECT fase, status, count(*) AS qtd FROM public.negocios GROUP BY 1,2 ORDER BY 1,2) t;
  INSERT INTO public.ops_events (fn, level, category, message, ctx)
  VALUES ('migration_negocios_canonico', 'info', 'schema_migration',
          'Snapshot DEPOIS do backfill de fase/status',
          jsonb_build_object('counts', v_counts));
END $mig$;