CREATE OR REPLACE VIEW public.v_oa_lista_potencial AS
 WITH stats_90d AS (
         SELECT t.lista_id,
            count(*)::integer AS tentativas_90d,
            count(*) FILTER (WHERE t.resultado = 'aproveitado'::text)::integer AS aproveitados_90d
           FROM oferta_ativa_tentativas t
          WHERE t.created_at >= (now() - '90 days'::interval) AND t.lista_id IS NOT NULL
          GROUP BY t.lista_id
        ), stats_hoje AS (
         SELECT oferta_ativa_tentativas.lista_id,
            count(*)::integer AS ligados_hoje
           FROM oferta_ativa_tentativas
          WHERE oferta_ativa_tentativas.created_at >= (now() AT TIME ZONE 'America/Sao_Paulo'::text)::date
          GROUP BY oferta_ativa_tentativas.lista_id
        ), disponivel AS (
         SELECT oferta_ativa_leads.lista_id,
            count(*)::integer AS na_fila
           FROM oferta_ativa_leads
          WHERE oferta_ativa_leads.status = 'disponivel'::text
          GROUP BY oferta_ativa_leads.lista_id
        )
 SELECT l.id AS lista_id,
    l.nome,
    l.empreendimento,
    l.empreendimento_canonico_id,
    l.segmento_id,
    l.is_base_semana,
    l.total_leads,
    COALESCE(d.na_fila, 0) AS na_fila,
    COALESCE(h.ligados_hoje, 0) AS ligados_hoje,
    COALESCE(s.tentativas_90d, 0) AS tentativas_90d,
    COALESCE(s.aproveitados_90d, 0) AS aproveitados_90d,
        CASE
            WHEN COALESCE(s.tentativas_90d, 0) = 0 THEN 0::numeric
            ELSE round(s.aproveitados_90d::numeric / s.tentativas_90d::numeric * 100::numeric, 1)
        END AS pct_aproveitamento_90d,
        CASE
            WHEN COALESCE(d.na_fila, 0) >= 100 AND COALESCE(s.tentativas_90d, 0) >= 20 AND (COALESCE(s.aproveitados_90d, 0)::numeric / NULLIF(s.tentativas_90d, 0)::numeric) >= 0.10 THEN 'alto'::text
            WHEN COALESCE(d.na_fila, 0) >= 30 AND COALESCE(s.tentativas_90d, 0) >= 10 AND (COALESCE(s.aproveitados_90d, 0)::numeric / NULLIF(s.tentativas_90d, 0)::numeric) >= 0.05 THEN 'bom'::text
            ELSE 'padrao'::text
        END AS potencial
   FROM oferta_ativa_listas l
     LEFT JOIN stats_90d s ON s.lista_id = l.id
     LEFT JOIN stats_hoje h ON h.lista_id = l.id
     LEFT JOIN disponivel d ON d.lista_id = l.id
  WHERE l.status = 'liberada'::text
    AND (l.expira_em IS NULL OR l.expira_em > now());