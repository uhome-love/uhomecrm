ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.pipeline_leads.is_teste IS 'Lead de teste: fora de roleta, relatórios e métricas de mídia';

DROP TRIGGER IF EXISTS trg_auto_distribute_new_lead ON public.pipeline_leads;
CREATE TRIGGER trg_auto_distribute_new_lead BEFORE INSERT ON public.pipeline_leads FOR EACH ROW
WHEN (new.corretor_id IS NULL AND new.aceite_status IS DISTINCT FROM 'pendente_distribuicao'::text AND new.is_teste = false)
EXECUTE FUNCTION trg_auto_distribute_lead();

CREATE OR REPLACE VIEW public.v_fato_lead AS
 SELECT l.id AS lead_id, l.nome, l.created_at,
    ((l.created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date AS data_entrada,
    (date_trunc('month'::text, (l.created_at AT TIME ZONE 'America/Sao_Paulo'::text)))::date AS mes_ref,
    l.origem, l.origem_detalhe, l.campanha, l.conjunto_anuncio, l.anuncio, l.plataforma, l.empreendimento,
    l.empreendimento_canonico_id, l.stage_id, st.nome AS stage_nome, l.arquivado, l.negocio_id,
    l.corretor_id AS corretor_auth_id, pr.nome AS corretor_nome, ce.equipe, ce.gerente_auth_id,
    COALESCE(ce.corretor_ativo, false) AS corretor_ativo
   FROM pipeline_leads l
     LEFT JOIN pipeline_stages st ON st.id = l.stage_id
     LEFT JOIN profiles pr ON pr.user_id = l.corretor_id
     LEFT JOIN LATERAL fn_equipe_na_data(l.corretor_id, ((l.created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date) ce(equipe, gerente_auth_id, corretor_ativo, equipe_atual) ON true
  WHERE l.is_teste = false;

CREATE OR REPLACE VIEW public.v_kpi_gestao_leads AS
 SELECT pl.corretor_id AS auth_user_id, (ph.created_at)::date AS data, ph.created_at AS raw_created_at,
    ph.id AS historico_id, ph.pipeline_lead_id, ps.nome AS stage_nome, ps.ordem AS stage_ordem,
        CASE
            WHEN (lower(ps.nome) ~~ '%contato%'::text) THEN 5
            WHEN (lower(ps.nome) ~~ '%qualifica%'::text) THEN 10
            WHEN ((lower(ps.nome) ~~ '%v.marcada%'::text) OR (lower(ps.nome) ~~ '%visita marcada%'::text)) THEN 30
            WHEN ((lower(ps.nome) ~~ '%v.realizada%'::text) OR (lower(ps.nome) ~~ '%visita realizada%'::text)) THEN 50
            ELSE 0
        END AS pontos
   FROM pipeline_historico ph
     JOIN pipeline_leads pl ON pl.id = ph.pipeline_lead_id
     JOIN pipeline_stages ps ON ps.id = ph.stage_novo_id
  WHERE pl.is_teste = false;

CREATE OR REPLACE VIEW public.v_meta_lead_performance AS
 WITH lead_agg AS (
         SELECT pl.ad_id, pl.adset_id, pl.campanha_id AS campaign_id, pl.plataforma, pl.empreendimento,
            (date_trunc('day'::text, (pl.created_at AT TIME ZONE 'America/Sao_Paulo'::text)))::date AS dia,
            count(*) AS leads,
            count(*) FILTER (WHERE (pl.arquivado = false)) AS leads_ativos,
            count(*) FILTER (WHERE (pl.motivo_descarte IS NOT NULL)) AS descartes,
            count(DISTINCT v.id) AS visitas,
            count(DISTINCT v.id) FILTER (WHERE (v.status = 'realizada'::text)) AS visitas_realizadas,
            count(DISTINCT n.id) FILTER (WHERE (n.fase = 'ganho'::text)) AS vendas
           FROM pipeline_leads pl
             LEFT JOIN visitas v ON v.pipeline_lead_id = pl.id
             LEFT JOIN negocios n ON n.pipeline_lead_id = pl.id
          WHERE pl.ad_id IS NOT NULL AND pl.is_teste = false
          GROUP BY pl.ad_id, pl.adset_id, pl.campanha_id, pl.plataforma, pl.empreendimento, ((date_trunc('day'::text, (pl.created_at AT TIME ZONE 'America/Sao_Paulo'::text)))::date)
        )
 SELECT l.dia, l.campaign_id, a.campaign_name, l.adset_id, a.adset_name, l.ad_id, a.ad_name,
    a.publisher_platform, a.platform_position, a.ad_format, l.plataforma, l.empreendimento,
    l.leads, l.leads_ativos, l.descartes, l.visitas, l.visitas_realizadas, l.vendas,
    a.spend, a.impressoes, a.cliques,
        CASE WHEN (l.leads > 0) THEN (a.spend / (l.leads)::numeric) ELSE NULL::numeric END AS cpl_real,
        CASE WHEN (l.visitas_realizadas > 0) THEN (a.spend / (l.visitas_realizadas)::numeric) ELSE NULL::numeric END AS custo_por_visita,
        CASE WHEN (l.vendas > 0) THEN (a.spend / (l.vendas)::numeric) ELSE NULL::numeric END AS custo_por_venda
   FROM lead_agg l
     LEFT JOIN marketing_entries_ad a ON a.ad_id = l.ad_id AND l.dia >= a.date_start AND l.dia <= a.date_stop;

CREATE OR REPLACE FUNCTION public.midia_refresh_jornada(p_dias integer DEFAULT 120)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_cutoff timestamptz := now() - make_interval(days => p_dias); v_n integer;
begin
  delete from public.midia_lead_jornada where created_at >= v_cutoff;
  insert into public.midia_lead_jornada
  select j.*, now(),
    nullif(pl.dados_site->'jornada'->>'numero_visitas','')::integer,
    pl.dados_site->'jornada'->'primeira_origem',
    pl.dados_site->'jornada'->'ultima_origem',
    pl.dados_site->'jornada'->'imoveis_vistos',
    pl.dados_site->'jornada'->'pedido'
  from public.v_midia_lead_jornada j
  left join public.pipeline_leads pl on pl.id = j.lead_id
  where j.created_at >= v_cutoff and coalesce(pl.is_teste, false) = false;
  get diagnostics v_n = row_count;
  return v_n;
end $$;