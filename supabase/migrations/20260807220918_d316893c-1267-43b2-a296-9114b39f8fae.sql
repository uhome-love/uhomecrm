CREATE OR REPLACE VIEW public.v_pdn_linhas
WITH (security_invoker = true) AS
SELECT
  l.id                                   AS pipeline_lead_id,
  l.nome                                 AS nome,
  l.corretor_id                          AS corretor_auth_id,
  s.tipo                                 AS stage_tipo,
  CASE s.tipo
    WHEN 'pos_visita'      THEN 'pos_visita'
    WHEN 'proposta'        THEN 'em_negociacao'
    WHEN 'contrato_gerado' THEN 'contrato'
    WHEN 'venda'           THEN 'ganho'
  END                                    AS grupo,
  COALESCE(l.stage_changed_at, l.updated_at) AS stage_changed_at,
  n.id                                   AS negocio_id,
  COALESCE(n.empreendimento, '—')        AS empreendimento,
  COALESCE(n.vgv_final, n.vgv_estimado, 0)::numeric AS vgv,
  n.data_assinatura                      AS data_assinatura,
  COALESCE(n.observacoes, '')            AS observacoes_negocio,
  (n.fase = 'ganho')                     AS negocio_vendido,
  pv.primeira_venda_em                   AS primeira_venda_em
FROM public.pipeline_leads l
JOIN public.pipeline_stages s
  ON s.id = l.stage_id
 AND s.tipo IN ('pos_visita', 'proposta', 'contrato_gerado', 'venda')
LEFT JOIN LATERAL (
  SELECT nn.*
  FROM public.negocios nn
  WHERE nn.pipeline_lead_id = l.id
    AND nn.status <> 'perdido'
  ORDER BY nn.updated_at DESC NULLS LAST
  LIMIT 1
) n ON TRUE
LEFT JOIN LATERAL (
  SELECT MIN(h.created_at) AS primeira_venda_em
  FROM public.pipeline_historico h
  JOIN public.pipeline_stages hs ON hs.id = h.stage_novo_id AND hs.tipo = 'venda'
  WHERE h.pipeline_lead_id = l.id
) pv ON TRUE
WHERE l.arquivado = false;

GRANT SELECT ON public.v_pdn_linhas TO authenticated;
GRANT SELECT ON public.v_pdn_linhas TO service_role;