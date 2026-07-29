-- ============================================================
-- CAMADA CANÔNICA DE MÉTRICAS — Fase 1: v_fato_venda
-- Somente leitura. Nenhuma tabela existente é alterada.
-- ============================================================

CREATE OR REPLACE VIEW public.v_fato_venda
WITH (security_invoker = on) AS
WITH ganho AS (
  SELECT
    n.id                                             AS negocio_id,
    n.data_assinatura,
    n.nome_cliente,
    n.empreendimento,
    n.empreendimento_canonico_id,
    n.pipeline_lead_id,
    COALESCE(n.vgv_final, n.vgv_estimado, 0)::numeric AS valor_negocio,
    -- negocios.corretor_id guarda profiles.id; normalizamos para auth.users.id
    COALESCE(p_prof.user_id, p_auth.user_id)          AS corretor_auth_id
  FROM public.negocios n
  LEFT JOIN public.profiles p_prof ON p_prof.id      = n.corretor_id
  LEFT JOIN public.profiles p_auth ON p_auth.user_id = n.corretor_id
  WHERE n.fase = 'ganho'
    AND n.data_assinatura IS NOT NULL
),
-- participantes: corretor do negócio + parceiros ativos do lead (deduplicados)
participante AS (
  SELECT g.negocio_id, g.corretor_auth_id AS auth_id
  FROM ganho g
  WHERE g.corretor_auth_id IS NOT NULL
  UNION
  SELECT g.negocio_id, pp.corretor_principal_id
  FROM ganho g
  JOIN public.pipeline_parcerias pp
    ON pp.pipeline_lead_id = g.pipeline_lead_id AND pp.status = 'ativa'
  WHERE pp.corretor_principal_id IS NOT NULL
  UNION
  SELECT g.negocio_id, pp.corretor_parceiro_id
  FROM ganho g
  JOIN public.pipeline_parcerias pp
    ON pp.pipeline_lead_id = g.pipeline_lead_id AND pp.status = 'ativa'
  WHERE pp.corretor_parceiro_id IS NOT NULL
),
rateio AS (
  SELECT
    pa.negocio_id,
    pa.auth_id,
    COUNT(*) OVER (PARTITION BY pa.negocio_id) AS qtd_participantes
  FROM participante pa
)
SELECT
  g.negocio_id,
  g.data_assinatura,
  (date_trunc('month', g.data_assinatura))::date          AS mes_ref,
  g.nome_cliente,
  g.empreendimento,
  g.empreendimento_canonico_id,
  g.pipeline_lead_id,
  g.valor_negocio,
  r.auth_id                                               AS corretor_auth_id,
  pr.nome                                                 AS corretor_nome,
  tm.equipe                                               AS equipe,
  tm.gerente_id                                           AS gerente_auth_id,
  r.qtd_participantes,
  (r.qtd_participantes > 1)                               AS em_parceria,
  (1::numeric / r.qtd_participantes)                      AS participacao,
  round(g.valor_negocio / r.qtd_participantes, 2)         AS vgv_rateado,
  -- contagem canônica: 1 venda por negócio, atribuída ao 1º participante em ordem estável
  (row_number() OVER (PARTITION BY g.negocio_id ORDER BY r.auth_id) = 1) AS conta_como_venda
FROM ganho g
JOIN rateio r        ON r.negocio_id = g.negocio_id
LEFT JOIN public.profiles pr ON pr.user_id = r.auth_id
LEFT JOIN public.team_members tm ON tm.user_id = r.auth_id AND tm.status = 'ativo';

COMMENT ON VIEW public.v_fato_venda IS
'Camada canônica de vendas. 1 linha por corretor participante. VGV assinado = fase ganho + data_assinatura (BRT), valor = vgv_final com fallback vgv_estimado, rateio igualitário (50/50) entre corretores em parceria ativa. Soma de vgv_rateado por negocio_id = valor_negocio (VGV nunca duplica). Contagem de vendas: filtrar conta_como_venda.';

GRANT SELECT ON public.v_fato_venda TO authenticated;
GRANT SELECT ON public.v_fato_venda TO service_role;