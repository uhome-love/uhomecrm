
CREATE OR REPLACE VIEW public.v_descartes_recentes_90d
WITH (security_invoker = true) AS
SELECT
  pl.id AS pipeline_lead_id,
  pl.nome,
  pl.telefone,
  pl.email,
  pl.segmento_id,
  pl.empreendimento_canonico_id,
  pl.origem,
  pl.stage_changed_at AS descartado_em,
  ec.nome AS empreendimento_nome,
  rs.nome AS segmento_nome
FROM public.pipeline_leads pl
LEFT JOIN public.empreendimentos_canonicos ec ON ec.id = pl.empreendimento_canonico_id
LEFT JOIN public.roleta_segmentos rs ON rs.id = pl.segmento_id
WHERE pl.stage_id = '1dd66c25-3848-4053-9f66-82e902989b4d'::uuid
  AND pl.arquivado = false
  AND pl.stage_changed_at >= (now() - interval '90 days')
  AND pl.telefone IS NOT NULL
  AND length(regexp_replace(pl.telefone, '[^0-9]', '', 'g')) >= 10;

GRANT SELECT ON public.v_descartes_recentes_90d TO authenticated;
GRANT SELECT ON public.v_descartes_recentes_90d TO service_role;

COMMENT ON VIEW public.v_descartes_recentes_90d IS
  'Leads descartados nos últimos 90 dias — reservados para Mutirão de Sexta e Reengajamento. NÃO devem entrar em bases frias de Oferta Ativa normal.';
