-- 1) Equipe canônica do corretor (mantém equipe histórica de desligados)
CREATE OR REPLACE VIEW public.v_corretor_equipe
WITH (security_invoker = true) AS
SELECT DISTINCT ON (tm.user_id)
  tm.user_id            AS corretor_auth_id,
  tm.equipe             AS equipe,
  tm.gerente_id         AS gerente_auth_id,
  (tm.status = 'ativo') AS corretor_ativo
FROM public.team_members tm
WHERE tm.user_id IS NOT NULL
ORDER BY tm.user_id, (tm.status = 'ativo') DESC, tm.updated_at DESC NULLS LAST, tm.created_at DESC NULLS LAST;

GRANT SELECT ON public.v_corretor_equipe TO authenticated;
GRANT SELECT ON public.v_corretor_equipe TO service_role;

-- 2) v_fato_venda: equipe histórica p/ desligados + flag corretor_ativo
DROP VIEW IF EXISTS public.v_fato_venda;
CREATE VIEW public.v_fato_venda
WITH (security_invoker = true) AS
WITH ganho AS (
  SELECT n.id AS negocio_id,
         n.data_assinatura,
         n.nome_cliente,
         n.empreendimento,
         n.empreendimento_canonico_id,
         n.pipeline_lead_id,
         COALESCE(n.vgv_final, n.vgv_estimado, 0::numeric) AS valor_negocio,
         COALESCE(p_prof.user_id, p_auth.user_id) AS corretor_auth_id
  FROM public.negocios n
  LEFT JOIN public.profiles p_prof ON p_prof.id = n.corretor_id
  LEFT JOIN public.profiles p_auth ON p_auth.user_id = n.corretor_id
  WHERE n.fase = 'ganho' AND n.data_assinatura IS NOT NULL
), participante AS (
  SELECT g.negocio_id, g.corretor_auth_id AS auth_id FROM ganho g WHERE g.corretor_auth_id IS NOT NULL
  UNION
  SELECT g.negocio_id, pp.corretor_principal_id
  FROM ganho g JOIN public.pipeline_parcerias pp
    ON pp.pipeline_lead_id = g.pipeline_lead_id AND pp.status = 'ativa'
  WHERE pp.corretor_principal_id IS NOT NULL
  UNION
  SELECT g.negocio_id, pp.corretor_parceiro_id
  FROM ganho g JOIN public.pipeline_parcerias pp
    ON pp.pipeline_lead_id = g.pipeline_lead_id AND pp.status = 'ativa'
  WHERE pp.corretor_parceiro_id IS NOT NULL
), rateio AS (
  SELECT pa.negocio_id, pa.auth_id, count(*) OVER (PARTITION BY pa.negocio_id) AS qtd_participantes
  FROM participante pa
)
SELECT g.negocio_id,
       g.data_assinatura,
       date_trunc('month', g.data_assinatura::timestamptz)::date AS mes_ref,
       g.nome_cliente,
       g.empreendimento,
       g.empreendimento_canonico_id,
       g.pipeline_lead_id,
       g.valor_negocio,
       r.auth_id AS corretor_auth_id,
       pr.nome   AS corretor_nome,
       ce.equipe,
       ce.gerente_auth_id,
       COALESCE(ce.corretor_ativo, false) AS corretor_ativo,
       r.qtd_participantes,
       r.qtd_participantes > 1 AS em_parceria,
       1::numeric / r.qtd_participantes::numeric AS participacao,
       round(g.valor_negocio / r.qtd_participantes::numeric, 2) AS vgv_rateado,
       row_number() OVER (PARTITION BY g.negocio_id ORDER BY r.auth_id) = 1 AS conta_como_venda
FROM ganho g
JOIN rateio r ON r.negocio_id = g.negocio_id
LEFT JOIN public.profiles pr ON pr.user_id = r.auth_id
LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = r.auth_id;

GRANT SELECT ON public.v_fato_venda TO authenticated;
GRANT SELECT ON public.v_fato_venda TO service_role;

-- 3) v_fato_visita
CREATE OR REPLACE VIEW public.v_fato_visita
WITH (security_invoker = true) AS
SELECT v.id AS visita_id,
       v.pipeline_lead_id,
       v.negocio_id,
       v.nome_cliente,
       v.empreendimento,
       v.empreendimento_canonico_id,
       v.status,
       v.resultado_visita,
       v.data_visita,
       (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_criacao,
       date_trunc('month', v.data_visita::timestamptz)::date  AS mes_ref,
       COALESCE(p_auth.user_id, p_prof.user_id) AS corretor_auth_id,
       pr.nome AS corretor_nome,
       ce.equipe,
       ce.gerente_auth_id,
       COALESCE(ce.corretor_ativo, false) AS corretor_ativo,
       (v.status = ANY (ARRAY['marcada','confirmada','realizada','reagendada'])) AS conta_marcada,
       (v.status = 'realizada') AS conta_realizada,
       (v.status = 'no_show')   AS conta_no_show
FROM public.visitas v
LEFT JOIN public.profiles p_auth ON p_auth.user_id = v.corretor_id
LEFT JOIN public.profiles p_prof ON p_prof.id = v.corretor_id
LEFT JOIN public.profiles pr ON pr.user_id = COALESCE(p_auth.user_id, p_prof.user_id)
LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = COALESCE(p_auth.user_id, p_prof.user_id);

GRANT SELECT ON public.v_fato_visita TO authenticated;
GRANT SELECT ON public.v_fato_visita TO service_role;

-- 4) v_fato_lead
CREATE OR REPLACE VIEW public.v_fato_lead
WITH (security_invoker = true) AS
SELECT l.id AS lead_id,
       l.nome,
       l.created_at,
       (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_entrada,
       date_trunc('month', l.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS mes_ref,
       l.origem,
       l.origem_detalhe,
       l.campanha,
       l.conjunto_anuncio,
       l.anuncio,
       l.plataforma,
       l.empreendimento,
       l.empreendimento_canonico_id,
       l.stage_id,
       st.nome AS stage_nome,
       l.arquivado,
       l.negocio_id,
       l.corretor_id AS corretor_auth_id,
       pr.nome AS corretor_nome,
       ce.equipe,
       ce.gerente_auth_id,
       COALESCE(ce.corretor_ativo, false) AS corretor_ativo
FROM public.pipeline_leads l
LEFT JOIN public.pipeline_stages st ON st.id = l.stage_id
LEFT JOIN public.profiles pr ON pr.user_id = l.corretor_id
LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = l.corretor_id;

GRANT SELECT ON public.v_fato_lead TO authenticated;
GRANT SELECT ON public.v_fato_lead TO service_role;