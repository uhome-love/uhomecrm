CREATE OR REPLACE VIEW public.v_negocios_pipeline
WITH (security_invoker = true) AS
SELECT
  l.id AS pipeline_lead_id,
  n.id AS negocio_id,
  CASE s.tipo WHEN 'contrato_gerado' THEN 'contrato' ELSE s.tipo END AS etapa,
  l.corretor_id AS corretor_auth_id,
  l.nome AS nome_cliente,
  COALESCE(n.empreendimento, l.empreendimento) AS empreendimento,
  l.empreendimento_canonico_id,
  COALESCE(n.vgv_final, n.vgv_estimado, l.valor_estimado, 0)::numeric AS vgv,
  NULL::date AS data_assinatura,
  l.stage_changed_at AS etapa_desde
FROM public.pipeline_leads l
JOIN public.pipeline_stages s ON s.id = l.stage_id
LEFT JOIN LATERAL (
  SELECT x.* FROM public.negocios x
  WHERE x.pipeline_lead_id = l.id AND x.status = 'ativo' AND x.fase <> 'ganho'
  ORDER BY x.updated_at DESC NULLS LAST LIMIT 1
) n ON true
WHERE COALESCE(l.arquivado, false) = false
  AND s.tipo IN ('documentacao', 'proposta', 'contrato_gerado')
UNION ALL
SELECT
  g.pipeline_lead_id,
  g.id,
  'ganho',
  g.auth_user_id,
  g.nome_cliente,
  g.empreendimento,
  g.empreendimento_canonico_id,
  COALESCE(NULLIF(g.vgv_final, 0), g.vgv_estimado, 0)::numeric,
  g.data_assinatura,
  g.fase_changed_at
FROM public.negocios g
WHERE g.fase = 'ganho' AND g.status = 'ativo';

COMMENT ON VIEW public.v_negocios_pipeline IS 'Fonte única de negócios: etapa vem do Pipeline (documentacao/proposta/contrato); ganho vem das vendas assinadas ativas. Pós-visita não é negócio.';

GRANT SELECT ON public.v_negocios_pipeline TO authenticated;
GRANT SELECT ON public.v_negocios_pipeline TO service_role;