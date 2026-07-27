-- ============================================================
-- marketing_entries_adset — métricas diárias por conjunto
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_entries_adset (
  id           uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid,
  campaign_id  text NOT NULL,
  campaign_name text,
  adset_id     text NOT NULL,
  adset_name   text,
  date_start   date NOT NULL,
  date_stop    date NOT NULL,
  spend        numeric DEFAULT 0,
  impressoes   integer DEFAULT 0,
  cliques      integer DEFAULT 0,
  leads        integer DEFAULT 0,
  cpc          numeric,
  ctr          numeric,
  cpl          numeric,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adset_id, date_start, date_stop)
);

GRANT SELECT ON public.marketing_entries_adset TO authenticated;
GRANT ALL ON public.marketing_entries_adset TO service_role;

ALTER TABLE public.marketing_entries_adset ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_adset"
  ON public.marketing_entries_adset
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_marketing_entries_adset_campaign ON public.marketing_entries_adset (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_entries_adset_date ON public.marketing_entries_adset (date_start);

-- ============================================================
-- marketing_entries_ad — métricas diárias por anúncio
--   com quebra por publisher_platform + platform_position
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_entries_ad (
  id                 uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid,
  campaign_id        text NOT NULL,
  campaign_name      text,
  adset_id           text NOT NULL,
  adset_name         text,
  ad_id              text NOT NULL,
  ad_name            text,
  publisher_platform text,      -- facebook | instagram | audience_network
  platform_position  text,      -- feed | reels | story | explore | search
  ad_format          text,      -- image | video | carousel | dynamic
  creative_type      text,
  date_start         date NOT NULL,
  date_stop          date NOT NULL,
  spend              numeric DEFAULT 0,
  impressoes         integer DEFAULT 0,
  cliques            integer DEFAULT 0,
  leads              integer DEFAULT 0,
  cpc                numeric,
  ctr                numeric,
  cpl                numeric,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_id, date_start, date_stop, publisher_platform, platform_position)
);

GRANT SELECT ON public.marketing_entries_ad TO authenticated;
GRANT ALL ON public.marketing_entries_ad TO service_role;

ALTER TABLE public.marketing_entries_ad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_ad"
  ON public.marketing_entries_ad
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_marketing_entries_ad_campaign ON public.marketing_entries_ad (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_entries_ad_adset ON public.marketing_entries_ad (adset_id);
CREATE INDEX IF NOT EXISTS idx_marketing_entries_ad_ad ON public.marketing_entries_ad (ad_id);
CREATE INDEX IF NOT EXISTS idx_marketing_entries_ad_date ON public.marketing_entries_ad (date_start);
CREATE INDEX IF NOT EXISTS idx_marketing_entries_ad_platform ON public.marketing_entries_ad (publisher_platform);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public._set_updated_at_marketing_ad()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_marketing_entries_adset_upd ON public.marketing_entries_adset;
CREATE TRIGGER trg_marketing_entries_adset_upd
  BEFORE UPDATE ON public.marketing_entries_adset
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at_marketing_ad();

DROP TRIGGER IF EXISTS trg_marketing_entries_ad_upd ON public.marketing_entries_ad;
CREATE TRIGGER trg_marketing_entries_ad_upd
  BEFORE UPDATE ON public.marketing_entries_ad
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at_marketing_ad();

-- ============================================================
-- v_meta_lead_performance — junta leads/visitas/vendas com custo
-- ============================================================
CREATE OR REPLACE VIEW public.v_meta_lead_performance AS
WITH lead_agg AS (
  SELECT
    pl.ad_id,
    pl.adset_id,
    pl.campanha_id AS campaign_id,
    pl.plataforma,
    pl.empreendimento,
    date_trunc('day', pl.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
    count(*)                                              AS leads,
    count(*) FILTER (WHERE pl.arquivado = false)          AS leads_ativos,
    count(*) FILTER (WHERE pl.motivo_descarte IS NOT NULL) AS descartes,
    count(DISTINCT v.id)                                  AS visitas,
    count(DISTINCT v.id) FILTER (WHERE v.status='realizada') AS visitas_realizadas,
    count(DISTINCT n.id) FILTER (WHERE n.fase='ganho')    AS vendas
  FROM public.pipeline_leads pl
  LEFT JOIN public.visitas  v ON v.pipeline_lead_id = pl.id
  LEFT JOIN public.negocios n ON n.pipeline_lead_id = pl.id
  WHERE pl.ad_id IS NOT NULL
  GROUP BY 1,2,3,4,5,6
)
SELECT
  l.dia,
  l.campaign_id,
  a.campaign_name,
  l.adset_id,
  a.adset_name,
  l.ad_id,
  a.ad_name,
  a.publisher_platform,
  a.platform_position,
  a.ad_format,
  l.plataforma,
  l.empreendimento,
  l.leads,
  l.leads_ativos,
  l.descartes,
  l.visitas,
  l.visitas_realizadas,
  l.vendas,
  a.spend,
  a.impressoes,
  a.cliques,
  CASE WHEN l.leads > 0 THEN a.spend / l.leads END                          AS cpl_real,
  CASE WHEN l.visitas_realizadas > 0 THEN a.spend / l.visitas_realizadas END AS custo_por_visita,
  CASE WHEN l.vendas > 0 THEN a.spend / l.vendas END                        AS custo_por_venda
FROM lead_agg l
LEFT JOIN public.marketing_entries_ad a
  ON a.ad_id = l.ad_id AND l.dia BETWEEN a.date_start AND a.date_stop;

GRANT SELECT ON public.v_meta_lead_performance TO authenticated;