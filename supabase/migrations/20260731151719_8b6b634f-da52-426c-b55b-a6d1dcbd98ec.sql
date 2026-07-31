CREATE OR REPLACE VIEW public.v_fato_visita AS
WITH base AS (
  SELECT v.*,
         COALESCE(v.pipeline_lead_id::text, lower(btrim(COALESCE(v.nome_cliente,'')))) AS cliente_key
  FROM public.visitas v
), ranked AS (
  SELECT b.*,
         row_number() OVER (
           PARTITION BY b.cliente_key, b.data_visita
           ORDER BY CASE b.status
                      WHEN 'realizada' THEN 1
                      WHEN 'confirmada' THEN 2
                      WHEN 'marcada' THEN 3
                      WHEN 'reagendada' THEN 4
                      WHEN 'no_show' THEN 5
                      WHEN 'cancelada' THEN 6
                      ELSE 7
                    END,
                    b.created_at,
                    b.id
         ) AS seq_dia
  FROM base b
)
SELECT v.id AS visita_id,
    v.pipeline_lead_id,
    v.negocio_id,
    v.nome_cliente,
    v.empreendimento,
    v.empreendimento_canonico_id,
    v.status,
    v.resultado_visita,
    v.data_visita,
    ((v.created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date AS data_criacao,
    (date_trunc('month'::text, (v.data_visita)::timestamp with time zone))::date AS mes_ref,
    COALESCE(p_auth.user_id, p_prof.user_id) AS corretor_auth_id,
    pr.nome AS corretor_nome,
    ce.equipe,
    ce.gerente_auth_id,
    COALESCE(ce.corretor_ativo, false) AS corretor_ativo,
    (v.status = ANY (ARRAY['marcada'::text, 'confirmada'::text, 'realizada'::text, 'reagendada'::text])) AS conta_marcada,
    (v.status = 'realizada'::text) AS conta_realizada,
    (v.status = 'no_show'::text) AS conta_no_show,
    (v.status = ANY (ARRAY['marcada'::text, 'confirmada'::text, 'reagendada'::text])) AS conta_a_realizar,
    v.cliente_key,
    v.seq_dia,
    (v.seq_dia = 1) AS visita_principal_dia
   FROM ((((ranked v
     LEFT JOIN public.profiles p_auth ON ((p_auth.user_id = v.corretor_id)))
     LEFT JOIN public.profiles p_prof ON ((p_prof.id = v.corretor_id)))
     LEFT JOIN public.profiles pr ON ((pr.user_id = COALESCE(p_auth.user_id, p_prof.user_id))))
     LEFT JOIN public.v_corretor_equipe ce ON ((ce.corretor_auth_id = COALESCE(p_auth.user_id, p_prof.user_id))));

CREATE OR REPLACE VIEW public.v_kpi_visitas AS
WITH ranked AS (
  SELECT v.*,
         COALESCE(v.pipeline_lead_id::text, lower(btrim(COALESCE(v.nome_cliente,'')))) AS cliente_key,
         row_number() OVER (
           PARTITION BY COALESCE(v.pipeline_lead_id::text, lower(btrim(COALESCE(v.nome_cliente,'')))), v.data_visita
           ORDER BY CASE v.status
                      WHEN 'realizada' THEN 1
                      WHEN 'confirmada' THEN 2
                      WHEN 'marcada' THEN 3
                      WHEN 'reagendada' THEN 4
                      WHEN 'no_show' THEN 5
                      WHEN 'cancelada' THEN 6
                      ELSE 7
                    END,
                    v.created_at,
                    v.id
         ) AS seq_dia
  FROM public.visitas v
)
SELECT corretor_id AS auth_user_id,
    id,
    (created_at)::date AS data_criacao,
    data_visita,
    status,
    empreendimento,
    origem,
        CASE
            WHEN (status = ANY (ARRAY['marcada'::text, 'confirmada'::text, 'realizada'::text, 'reagendada'::text])) THEN 1
            ELSE 0
        END AS conta_marcada,
        CASE
            WHEN (status = 'realizada'::text) THEN 1
            ELSE 0
        END AS conta_realizada,
        CASE
            WHEN (status = 'no_show'::text) THEN 1
            ELSE 0
        END AS conta_no_show,
    cliente_key,
    seq_dia,
    (seq_dia = 1) AS visita_principal_dia
   FROM ranked v;