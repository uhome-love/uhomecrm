-- 1. Migrar negócios da fase 'assinado' para 'vendido' (segurança)
UPDATE public.negocios
SET fase = 'vendido',
    data_assinatura = COALESCE(data_assinatura, now())
WHERE fase = 'assinado';

-- 2. Atualizar view v_kpi_negocios — conta_venda apenas para 'vendido'
CREATE OR REPLACE VIEW public.v_kpi_negocios AS
  SELECT COALESCE(n.auth_user_id, p.user_id) AS auth_user_id,
     n.id,
     n.created_at::date AS data_criacao,
     n.data_assinatura,
     n.fase,
     n.empreendimento,
     n.vgv_estimado,
     n.vgv_final,
     COALESCE(n.vgv_final, n.vgv_estimado) AS vgv_efetivo,
     n.pipeline_lead_id,
     n.corretor_id AS profile_id,
     CASE WHEN n.fase = ANY (ARRAY['proposta'::text, 'negociacao'::text, 'documentacao'::text]) THEN 1 ELSE 0 END AS conta_proposta,
     CASE WHEN n.fase = 'vendido'::text THEN 1 ELSE 0 END AS conta_venda,
     CASE WHEN n.fase = ANY (ARRAY['perdido'::text, 'cancelado'::text, 'distrato'::text]) THEN 1 ELSE 0 END AS conta_perdido,
     1.0 AS fator_split,
     false AS is_parceria,
     NULL::uuid AS parceria_id
    FROM negocios n
      LEFT JOIN profiles p ON p.id = n.corretor_id
   WHERE n.pipeline_lead_id IS NULL OR NOT (EXISTS ( SELECT 1
            FROM pipeline_parcerias pp
           WHERE pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status = 'ativa'::text))
 UNION ALL
  SELECT pp.corretor_principal_id AS auth_user_id,
     n.id,
     n.created_at::date AS data_criacao,
     n.data_assinatura,
     n.fase,
     n.empreendimento,
     round(n.vgv_estimado * pp.divisao_principal::numeric / 100.0, 2) AS vgv_estimado,
     CASE WHEN n.vgv_final IS NOT NULL THEN round(n.vgv_final * pp.divisao_principal::numeric / 100.0, 2) ELSE NULL::numeric END AS vgv_final,
     round(COALESCE(n.vgv_final, n.vgv_estimado) * pp.divisao_principal::numeric / 100.0, 2) AS vgv_efetivo,
     n.pipeline_lead_id,
     n.corretor_id AS profile_id,
     CASE WHEN n.fase = ANY (ARRAY['proposta'::text, 'negociacao'::text, 'documentacao'::text]) THEN 1 ELSE 0 END AS conta_proposta,
     CASE WHEN n.fase = 'vendido'::text THEN 1 ELSE 0 END AS conta_venda,
     CASE WHEN n.fase = ANY (ARRAY['perdido'::text, 'cancelado'::text, 'distrato'::text]) THEN 1 ELSE 0 END AS conta_perdido,
     pp.divisao_principal::numeric / 100.0 AS fator_split,
     true AS is_parceria,
     pp.id AS parceria_id
    FROM negocios n
      JOIN pipeline_parcerias pp ON pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status = 'ativa'::text
 UNION ALL
  SELECT pp.corretor_parceiro_id AS auth_user_id,
     n.id,
     n.created_at::date AS data_criacao,
     n.data_assinatura,
     n.fase,
     n.empreendimento,
     round(n.vgv_estimado * pp.divisao_parceiro::numeric / 100.0, 2) AS vgv_estimado,
     CASE WHEN n.vgv_final IS NOT NULL THEN round(n.vgv_final * pp.divisao_parceiro::numeric / 100.0, 2) ELSE NULL::numeric END AS vgv_final,
     round(COALESCE(n.vgv_final, n.vgv_estimado) * pp.divisao_parceiro::numeric / 100.0, 2) AS vgv_efetivo,
     n.pipeline_lead_id,
     n.corretor_id AS profile_id,
     CASE WHEN n.fase = ANY (ARRAY['proposta'::text, 'negociacao'::text, 'documentacao'::text]) THEN 1 ELSE 0 END AS conta_proposta,
     CASE WHEN n.fase = 'vendido'::text THEN 1 ELSE 0 END AS conta_venda,
     CASE WHEN n.fase = ANY (ARRAY['perdido'::text, 'cancelado'::text, 'distrato'::text]) THEN 1 ELSE 0 END AS conta_perdido,
     pp.divisao_parceiro::numeric / 100.0 AS fator_split,
     true AS is_parceria,
     pp.id AS parceria_id
    FROM negocios n
      JOIN pipeline_parcerias pp ON pp.pipeline_lead_id = n.pipeline_lead_id AND pp.status = 'ativa'::text;

-- 3. Remover etapa órfã 'Assinado' da pipeline_stages
DELETE FROM public.pipeline_stages
WHERE LOWER(nome) = 'assinado' OR tipo = 'assinatura';