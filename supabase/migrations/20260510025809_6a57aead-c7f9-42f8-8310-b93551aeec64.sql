
-- ============================================================================
-- Onda 0 · Etapa 2 — Migration de PREPARO
-- Objetivo: adicionar colunas de staging para religação de negócios órfãos
--           e flags de revisão de duplicados em leads.
-- ZERO mutação em dados de negócio. Apenas estrutura.
-- ============================================================================

-- ---- NEGOCIOS: colunas de staging para religação ----
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS lead_id_proposto uuid NULL,
  ADD COLUMN IF NOT EXISTS lead_id_match_metodo text NULL,
  ADD COLUMN IF NOT EXISTS lead_id_match_score smallint NULL,
  ADD COLUMN IF NOT EXISTS requer_aprovacao_ceo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.negocios.lead_id_proposto IS
  'Onda 0: lead candidato sugerido pela religação automática. NÃO é vínculo efetivo — só vira lead_id após aprovação humana via /ceo/religacao-negocios.';
COMMENT ON COLUMN public.negocios.lead_id_match_metodo IS
  'Método do match: B_nome_telefone | D_somente_telefone | manual | aprovado_ceo | rejeitado';
COMMENT ON COLUMN public.negocios.lead_id_match_score IS
  '1=seguro (único candidato), 2=ambíguo (múltiplos), 3=manual (sem match automático)';
COMMENT ON COLUMN public.negocios.requer_aprovacao_ceo IS
  'true quando VGV >= R$1M ou ambiguidade no match. Bloqueia religação automática.';

CREATE INDEX IF NOT EXISTS ix_negocios_lead_id_proposto
  ON public.negocios (lead_id_proposto)
  WHERE lead_id_proposto IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_negocios_requer_aprovacao_ceo
  ON public.negocios (requer_aprovacao_ceo)
  WHERE requer_aprovacao_ceo = true;

-- FK suave para evitar lead_id_proposto apontando para lead inexistente
ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS fk_negocios_lead_id_proposto;
ALTER TABLE public.negocios
  ADD CONSTRAINT fk_negocios_lead_id_proposto
  FOREIGN KEY (lead_id_proposto) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

-- ---- PIPELINE_LEADS: flags de revisão de duplicados ----
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS requer_revisao_dedup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dedup_grupo_id uuid NULL;

COMMENT ON COLUMN public.pipeline_leads.requer_revisao_dedup IS
  'Onda 0: true quando o lead está em um grupo de duplicados detectado (email ou telefone). Decisão humana via /gerente/dedup-revisao.';
COMMENT ON COLUMN public.pipeline_leads.dedup_grupo_id IS
  'UUID do grupo de duplicados — leads com mesmo dedup_grupo_id são candidatos a fusão/descarte.';

CREATE INDEX IF NOT EXISTS ix_pipeline_leads_dedup_grupo
  ON public.pipeline_leads (dedup_grupo_id)
  WHERE dedup_grupo_id IS NOT NULL;

-- ---- RLS: leitura para autenticados (controle de escrita fica em service role / triggers futuros) ----
-- As tabelas já têm RLS ativo; as colunas novas herdam as policies existentes.
-- Não alteramos policies aqui para não impactar escrita atual.
-- A escrita em lead_id_proposto / dedup_grupo_id virá EXCLUSIVAMENTE via service nas próximas etapas.
