
-- =====================================================
-- Partnership-Aware v_kpi_negocios
-- 
-- Extends the official deals KPI view to support 50/50
-- (or custom) split attribution from pipeline_parcerias.
--
-- Anti-double-counting:
--   - Solo deals: full VGV to original corretor (fator_split = 1.0)
--   - Partnership deals: VGV split per divisao_principal/divisao_parceiro
--   - SUM(vgv_efetivo) across all rows for a deal = original deal VGV
--
-- New columns:
--   - fator_split: decimal factor (0.0-1.0) applied to VGV
--   - is_parceria: boolean flag for filtering/auditing
--   - parceria_id: UUID of the partnership record (NULL for solo)
-- =====================================================

CREATE OR REPLACE VIEW public.v_kpi_negocios AS

-- Solo deals (no active partnership or no pipeline_lead_id)
SELECT
  COALESCE(n.auth_user_id, p.user_id) AS auth_user_id,
  n.id,
  n.created_at::date AS data_criacao,
  n.data_assinatura::date AS data_assinatura,
  n.fase,
  n.empreendimento,
  n.vgv_estimado,
  n.vgv_final,
  COALESCE(n.vgv_final, n.vgv_estimado) AS vgv_efetivo,
  n.pipeline_lead_id,
  n.corretor_id AS profile_id,
  CASE WHEN n.fase IN ('proposta','negociacao','documentacao') THEN 1 ELSE 0 END AS conta_proposta,
  CASE WHEN n.fase IN ('assinado','vendido') THEN 1 ELSE 0 END AS conta_venda,
  CASE WHEN n.fase IN ('perdido','cancelado','distrato') THEN 1 ELSE 0 END AS conta_perdido,
  1.0::numeric AS fator_split,
  FALSE AS is_parceria,
  NULL::uuid AS parceria_id
FROM public.negocios n
LEFT JOIN public.profiles p ON p.id = n.corretor_id
WHERE n.pipeline_lead_id IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM public.pipeline_parcerias pp
     WHERE pp.pipeline_lead_id = n.pipeline_lead_id
       AND pp.status = 'ativa'
   )

UNION ALL

-- Principal partner row (split VGV by divisao_principal)
SELECT
  pp.corretor_principal_id AS auth_user_id,
  n.id,
  n.created_at::date AS data_criacao,
  n.data_assinatura::date AS data_assinatura,
  n.fase,
  n.empreendimento,
  ROUND(n.vgv_estimado * pp.divisao_principal / 100.0, 2) AS vgv_estimado,
  CASE WHEN n.vgv_final IS NOT NULL 
    THEN ROUND(n.vgv_final * pp.divisao_principal / 100.0, 2) 
    ELSE NULL 
  END AS vgv_final,
  ROUND(COALESCE(n.vgv_final, n.vgv_estimado) * pp.divisao_principal / 100.0, 2) AS vgv_efetivo,
  n.pipeline_lead_id,
  n.corretor_id AS profile_id,
  CASE WHEN n.fase IN ('proposta','negociacao','documentacao') THEN 1 ELSE 0 END AS conta_proposta,
  CASE WHEN n.fase IN ('assinado','vendido') THEN 1 ELSE 0 END AS conta_venda,
  CASE WHEN n.fase IN ('perdido','cancelado','distrato') THEN 1 ELSE 0 END AS conta_perdido,
  (pp.divisao_principal / 100.0)::numeric AS fator_split,
  TRUE AS is_parceria,
  pp.id AS parceria_id
FROM public.negocios n
JOIN public.pipeline_parcerias pp 
  ON pp.pipeline_lead_id = n.pipeline_lead_id 
  AND pp.status = 'ativa'

UNION ALL

-- Partner row (split VGV by divisao_parceiro)
SELECT
  pp.corretor_parceiro_id AS auth_user_id,
  n.id,
  n.created_at::date AS data_criacao,
  n.data_assinatura::date AS data_assinatura,
  n.fase,
  n.empreendimento,
  ROUND(n.vgv_estimado * pp.divisao_parceiro / 100.0, 2) AS vgv_estimado,
  CASE WHEN n.vgv_final IS NOT NULL 
    THEN ROUND(n.vgv_final * pp.divisao_parceiro / 100.0, 2) 
    ELSE NULL 
  END AS vgv_final,
  ROUND(COALESCE(n.vgv_final, n.vgv_estimado) * pp.divisao_parceiro / 100.0, 2) AS vgv_efetivo,
  n.pipeline_lead_id,
  n.corretor_id AS profile_id,
  CASE WHEN n.fase IN ('proposta','negociacao','documentacao') THEN 1 ELSE 0 END AS conta_proposta,
  CASE WHEN n.fase IN ('assinado','vendido') THEN 1 ELSE 0 END AS conta_venda,
  CASE WHEN n.fase IN ('perdido','cancelado','distrato') THEN 1 ELSE 0 END AS conta_perdido,
  (pp.divisao_parceiro / 100.0)::numeric AS fator_split,
  TRUE AS is_parceria,
  pp.id AS parceria_id
FROM public.negocios n
JOIN public.pipeline_parcerias pp 
  ON pp.pipeline_lead_id = n.pipeline_lead_id 
  AND pp.status = 'ativa';

-- Re-apply security settings
ALTER VIEW public.v_kpi_negocios SET (security_invoker = true);
GRANT SELECT ON public.v_kpi_negocios TO authenticated;
