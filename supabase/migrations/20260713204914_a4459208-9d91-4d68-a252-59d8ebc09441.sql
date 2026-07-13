CREATE OR REPLACE FUNCTION public.get_relatorio_origem_performance(
  p_start date,
  p_end date,
  p_corretor_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid,
  nome text,
  created_at timestamptz,
  origem text,
  campanha text,
  conjunto_anuncio text,
  anuncio text,
  plataforma text,
  empreendimento text,
  corretor_id uuid,
  corretor_nome text,
  stage_nome text,
  motivo_descarte text,
  tipo_descarte text,
  primeiro_contato_em timestamptz,
  tempo_ate_primeiro_contato_min integer,
  tem_visita_realizada boolean,
  tem_venda boolean,
  vgv numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.id,
    pl.nome,
    pl.created_at,
    pl.origem,
    pl.campanha,
    pl.conjunto_anuncio,
    pl.anuncio,
    pl.plataforma,
    pl.empreendimento,
    pl.corretor_id,
    p.nome AS corretor_nome,
    st.nome AS stage_nome,
    pl.motivo_descarte,
    pl.tipo_descarte,
    pc.t AS primeiro_contato_em,
    CASE WHEN pc.t IS NOT NULL
      THEN GREATEST(0, round(extract(epoch FROM (pc.t - pl.created_at)) / 60))::int
      ELSE NULL END AS tempo_ate_primeiro_contato_min,
    COALESCE(v.tem_visita, false) AS tem_visita_realizada,
    COALESCE(n.tem_venda, false) AS tem_venda,
    COALESCE(n.vgv, 0) AS vgv
  FROM pipeline_leads pl
  LEFT JOIN profiles p ON p.user_id = pl.corretor_id
  LEFT JOIN pipeline_stages st ON st.id = pl.stage_id
  LEFT JOIN LATERAL (
    SELECT min(t) AS t FROM (
      SELECT min(w.timestamp) AS t
        FROM whatsapp_mensagens w
       WHERE w.lead_id = pl.id AND w.direction = 'sent'
      UNION ALL
      SELECT min(a.created_at) AS t
        FROM pipeline_atividades a
       WHERE a.pipeline_lead_id = pl.id
         AND (a.tipo IN ('whatsapp','ligacao','contato','mensagem','email','visita','reuniao','proposta','nao_atendeu')
              OR a.tipo_contato IS NOT NULL)
    ) s
  ) pc ON true
  LEFT JOIN LATERAL (
    SELECT true AS tem_visita
      FROM visitas vi
     WHERE vi.pipeline_lead_id = pl.id AND vi.status = 'realizada'
     LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT (count(*) > 0) AS tem_venda,
           sum(COALESCE(ng.vgv_final, ng.vgv_estimado, 0)) AS vgv
      FROM negocios ng
     WHERE ng.pipeline_lead_id = pl.id AND ng.fase = 'vendido'
  ) n ON true
  WHERE pl.created_at >= p_start::timestamptz
    AND pl.created_at < (p_end::timestamptz + interval '1 day')
    AND (p_corretor_ids IS NULL OR pl.corretor_id = ANY(p_corretor_ids));
$$;

GRANT EXECUTE ON FUNCTION public.get_relatorio_origem_performance(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_origem_performance(date, date, uuid[]) TO service_role;