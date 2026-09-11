-- ============================================================
-- UHOME MÍDIA · Fase 0 · Fundação do dado
-- App de inteligência de mídia (projeto Lovable separado, MESMO banco).
-- Regras de convivência:
--   1. O app só escreve nas tabelas midia_*.
--   2. Ação sobre lead usa as funções já existentes do CRM.
--   3. CAPI continua nos gatilhos do banco.
-- Tudo aqui é ADITIVO: nenhuma tabela ou função existente é alterada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Foto diária por anúncio (canal como dimensão desde o dia 1)
-- ------------------------------------------------------------
create table if not exists public.midia_snapshot_diario (
  canal              text        not null default 'meta',
  dia                date        not null,
  ad_id              text        not null,
  adset_id           text,
  campaign_id        text,
  ad_name            text,
  adset_name         text,
  campaign_name      text,
  objective          text,
  optimization_goal  text,
  spend              numeric(12,2) not null default 0,
  impressions        bigint      not null default 0,
  reach              bigint      not null default 0,
  frequency          numeric(8,3),
  clicks             bigint      not null default 0,
  link_clicks        bigint      not null default 0,
  ctr                numeric(8,4),
  cpc                numeric(10,4),
  cpm                numeric(10,4),
  leads_meta         integer     not null default 0,   -- action_type lead / onsite lead
  lead_qualificado_meta integer  not null default 0,   -- conversão personalizada LeadQualificado (CRM)
  visita_marcada_meta   integer  not null default 0,   -- conversão personalizada Visita Marcada (CRM)
  video_plays        bigint      not null default 0,   -- video_play_actions
  video_3s           bigint      not null default 0,   -- actions.video_view (3s)
  thruplays          bigint      not null default 0,   -- video_thruplay_watched_actions (15s)
  video_p25          bigint      not null default 0,
  video_p50          bigint      not null default 0,
  video_p75          bigint      not null default 0,
  video_p100         bigint      not null default 0,
  video_avg_time     numeric(8,2),
  actions            jsonb,
  cost_per_action    jsonb,
  sincronizado_em    timestamptz not null default now(),
  primary key (canal, dia, ad_id)
);
create index if not exists idx_midia_snap_campaign_dia on public.midia_snapshot_diario (campaign_id, dia);
create index if not exists idx_midia_snap_adset_dia    on public.midia_snapshot_diario (adset_id, dia);
create index if not exists idx_midia_snap_dia          on public.midia_snapshot_diario (dia);
comment on table public.midia_snapshot_diario is 'Uhome Mídia: foto diária de cada anúncio (gasto, alcance, vídeo, conversões) vinda da API do canal. Grão: canal × dia × anúncio.';

-- ------------------------------------------------------------
-- 2. Criativos (asset + classificação humana/IA)
-- ------------------------------------------------------------
create table if not exists public.midia_criativos (
  canal              text        not null default 'meta',
  ad_id              text        not null,
  creative_id        text,
  campaign_id        text,
  adset_id           text,
  ad_name            text,
  campaign_name      text,
  adset_name         text,
  ad_status          text,
  effective_status   text,
  tipo               text,          -- video | imagem | carrossel | outro
  thumbnail_url      text,
  image_url          text,
  image_hash         text,
  video_id           text,
  titulo             text,
  corpo              text,
  cta                text,
  link_url           text,
  form_id            text,
  -- classificação (nunca sobrescrita pelo sync)
  familia            text,          -- ex.: "Vídeo Gabriel Tour", "Imagem preço herói"
  gancho             text,
  formato            text,          -- feed 4:5, stories 9:16 ...
  tags               text[]      not null default '{}',
  classificado_por   text,          -- ia | lucas
  classificado_em    timestamptz,
  -- metadados do canal
  criado_em          timestamptz,
  atualizado_em      timestamptz,
  raw                jsonb,
  sincronizado_em    timestamptz not null default now(),
  primary key (canal, ad_id)
);
create index if not exists idx_midia_criativos_campaign on public.midia_criativos (campaign_id);
create index if not exists idx_midia_criativos_familia  on public.midia_criativos (familia);
comment on table public.midia_criativos is 'Uhome Mídia: cada anúncio com seu criativo (miniatura, texto, vídeo) e a classificação por família/gancho.';

-- ------------------------------------------------------------
-- 3. Recomendações (cartões do Briefing) e Diário de decisões
-- ------------------------------------------------------------
create table if not exists public.midia_recomendacoes (
  id                 uuid        primary key default gen_random_uuid(),
  dia                date        not null default (now() at time zone 'America/Sao_Paulo')::date,
  tipo               text        not null,   -- anomalia | escalar | cortar | criativo | publico | rastreio | time | qualidade
  prioridade         integer     not null default 3,  -- 1 alta · 5 baixa
  canal              text        not null default 'meta',
  entidade_tipo      text,                   -- conta | campaign | adset | ad | lead
  entidade_id        text,
  entidade_nome      text,
  titulo             text        not null,
  resumo             text,
  evidencia          jsonb,                  -- números que sustentam
  acao               jsonb,                  -- {op:'pause'|'budget'|..., params:{...}} ou null (só alerta)
  status             text        not null default 'pendente'
                     check (status in ('pendente','aprovado','rejeitado','executado','expirado','erro')),
  decidido_em        timestamptz,
  decidido_via       text,                   -- app | homi
  motivo_rejeicao    text,
  executado_em       timestamptz,
  resultado          jsonb,
  created_at         timestamptz not null default now()
);
create index if not exists idx_midia_recom_dia_status on public.midia_recomendacoes (dia desc, status);

create table if not exists public.midia_decisoes (
  id                 uuid        primary key default gen_random_uuid(),
  quando             timestamptz not null default now(),
  origem             text        not null,   -- app | homi | agente | meta_log | manual
  canal              text        not null default 'meta',
  entidade_tipo      text,
  entidade_id        text,
  entidade_nome      text,
  acao               text        not null,   -- pausar | ativar | budget | duplicar | publico | criativo | nota
  antes              jsonb,
  depois             jsonb,
  motivo             text,
  recomendacao_id    uuid        references public.midia_recomendacoes(id) on delete set null,
  efeito_7d          jsonb,
  efeito_14d         jsonb,
  created_by         uuid
);
create index if not exists idx_midia_decisoes_quando on public.midia_decisoes (quando desc);
create index if not exists idx_midia_decisoes_entidade on public.midia_decisoes (entidade_tipo, entidade_id);

create table if not exists public.midia_sync_runs (
  id                 bigint      generated always as identity primary key,
  funcao             text        not null,
  modo               text,
  since              date,
  until              date,
  iniciado_em        timestamptz not null default now(),
  terminado_em       timestamptz,
  ok                 boolean,
  linhas             integer,
  detalhe            jsonb,
  erro               text
);

-- ------------------------------------------------------------
-- 4. Segurança: só admin (Lucas) lê/escreve pelo app; service_role passa direto
-- ------------------------------------------------------------
alter table public.midia_snapshot_diario enable row level security;
alter table public.midia_criativos       enable row level security;
alter table public.midia_recomendacoes   enable row level security;
alter table public.midia_decisoes        enable row level security;
alter table public.midia_sync_runs       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['midia_snapshot_diario','midia_criativos','midia_recomendacoes','midia_decisoes','midia_sync_runs'] loop
    execute format('drop policy if exists midia_admin_all on public.%I', t);
    execute format(
      'create policy midia_admin_all on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))',
      t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. Jornada do lead de mídia, ponta a ponta, uma linha por lead
--    (fonte única pro Funil, Mesa de leads, Qualidade e Briefing)
-- ------------------------------------------------------------
create or replace view public.v_midia_lead_jornada
with (security_invoker = true) as
-- Subconsultas LATERAL (correlacionadas) para o filtro por created_at empurrar
-- pro índice da pipeline_leads. Nunca agregar as tabelas inteiras em CTE.
select
  pl.id                                   as lead_id,
  pl.created_at,
  (pl.created_at at time zone 'America/Sao_Paulo')::date as dia,
  case
    when pl.meta_lead_id is not null or pl.ad_id is not null or pl.campanha_id is not null or pl.ctwa_clid is not null
      or lower(coalesce(pl.origem,'')) in ('ig','fb','an','meta_ads','meta','instagram','facebook','facebookads','facebook leads ads','meta ads','meta_backfill')
      then 'meta'
    when lower(coalesce(pl.origem,'')) like '%tiktok%' then 'tiktok'
    when lower(coalesce(pl.origem,'')) like '%google%' then 'google'
    else 'outro'
  end                                     as canal,
  pl.plataforma, pl.origem, pl.origem_detalhe,
  pl.campanha_id as campaign_id, pl.campanha, pl.conjunto_anuncio, pl.ad_id, pl.anuncio,
  pl.form_id, pl.form_name, pl.formulario, pl.meta_lead_id, pl.ctwa_clid,
  pl.empreendimento, pl.empreendimento_canonico_id,
  pl.corretor_id, pr.nome as corretor_nome,
  pl.stage_id, s.tipo as stage_tipo, s.nome as stage_nome, pl.stage_changed_at,
  pl.temperatura, pl.lead_temperatura, pl.lead_score,
  coalesce(pl.primeiro_contato_em, ativ.primeiro_toque_em) as primeiro_contato_em,
  case when coalesce(pl.primeiro_contato_em, ativ.primeiro_toque_em) is not null
       then round(extract(epoch from (coalesce(pl.primeiro_contato_em, ativ.primeiro_toque_em) - pl.created_at)) / 60)::integer end as minutos_ate_contato,
  coalesce(ativ.toques, 0) as toques,
  ativ.ultimo_toque_em,
  coalesce(hist.qualificado_em,
           case when s.tipo in ('qualificacao','aquecimento','visita','pos_visita','documentacao','proposta','contrato_gerado','venda') then pl.stage_changed_at end) as qualificado_em,
  vis.visita_marcada_em, vis.visita_realizada_em,
  coalesce(vis.visitas_qtd, 0) as visitas_qtd,
  coalesce(vis.teve_no_show, false) as teve_no_show,
  coalesce(vis.teve_visita_realizada, false) as teve_visita_realizada,
  vis.resultado_visita,
  coalesce(hist.negocio_em,
           case when s.tipo in ('documentacao','proposta','contrato_gerado','venda') then pl.stage_changed_at end) as negocio_em,
  vend.venda_em, vend.vgv_rateado,
  (pl.motivo_descarte is not null or s.tipo = 'descarte') as descartado,
  coalesce(hist.descartado_em, case when s.tipo = 'descarte' then pl.stage_changed_at end) as descartado_em,
  pl.motivo_descarte, pl.motivo_descarte_code, pl.tipo_descarte,
  (s.tipo = 'sem_contato') as sem_contato,
  coalesce(pl.arquivado, false) as arquivado,
  coalesce(pr.ativo, true) as corretor_ativo,
  public.lead_saude_status(ativ.ultimo_toque_em, now(), s.tipo) as saude,
  lia.lia_status, lia.lia_nivel, lia.lia_qualificado_em, coalesce(lia.lia_agendou,false) as lia_agendou,
  lia.lia_repassado_em, lia.lia_descartado_em, lia.lia_motivo,
  coalesce(capi.capi_enviados, '{}') as capi_enviados,
  coalesce(capi.capi_falhas, 0) as capi_falhas
from public.pipeline_leads pl
left join public.pipeline_stages s on s.id = pl.stage_id
left join public.profiles pr on pr.user_id = pl.corretor_id
left join lateral (
  select
    min(h.created_at) filter (where st.tipo in ('qualificacao','aquecimento','visita','pos_visita','documentacao','proposta','contrato_gerado','venda')) as qualificado_em,
    min(h.created_at) filter (where st.tipo in ('documentacao','proposta','contrato_gerado','venda')) as negocio_em,
    min(h.created_at) filter (where st.tipo = 'descarte') as descartado_em
  from public.pipeline_historico h
  join public.pipeline_stages st on st.id = h.stage_novo_id
  where h.pipeline_lead_id = pl.id
) hist on true
left join lateral (
  select
    count(*) filter (where a.tipo in ('whatsapp','ligacao','contato','presencial','visita','nota','outro')) as toques,
    min(a.created_at) filter (where a.tipo in ('whatsapp','ligacao','contato','presencial')) as primeiro_toque_em,
    max(a.created_at) filter (where a.tipo in ('whatsapp','ligacao','contato','presencial','visita','nota','outro')) as ultimo_toque_em
  from public.pipeline_atividades a
  where a.pipeline_lead_id = pl.id
) ativ on true
left join lateral (
  select
    count(*) as visitas_qtd,
    min(v.created_at) as visita_marcada_em,
    min(v.data_visita) filter (where v.status = 'realizada') as visita_realizada_em,
    bool_or(v.status = 'no_show') as teve_no_show,
    bool_or(v.status = 'realizada') as teve_visita_realizada,
    max(v.resultado_visita) as resultado_visita
  from public.visitas v
  where v.pipeline_lead_id = pl.id
) vis on true
left join lateral (
  select min(f.data_assinatura) as venda_em, sum(f.vgv_rateado) as vgv_rateado
  from public.v_fato_venda f
  where f.pipeline_lead_id = pl.id and f.conta_como_venda
) vend on true
left join lateral (
  select
    array_agg(distinct q.event_name) filter (where q.status = 'sent') as capi_enviados,
    count(*) filter (where q.status = 'failed') as capi_falhas
  from public.meta_capi_queue q
  where q.lead_id = pl.id
) capi on true
left join lateral (
  select
    max(l.status) as lia_status, max(l.nivel) as lia_nivel, max(l.qualificado_em) as lia_qualificado_em,
    bool_or(coalesce(l.agendou,false)) as lia_agendou, max(l.repassado_em) as lia_repassado_em,
    max(l.descartado_em) as lia_descartado_em, max(l.motivo) as lia_motivo
  from public.lia_estado l
  where l.lead_id = pl.id
) lia on true;

comment on view public.v_midia_lead_jornada is 'Uhome Mídia: jornada ponta a ponta de cada lead (clique → contato → LIA → qualificação → visita → negócio → venda | descarte | arquivo | CAPI). Uma linha por lead. Filtrar por created_at no app.';

-- ------------------------------------------------------------
-- 6. Funil por entidade com janela de maturidade (a régua da casa)
--    p_nivel: 'campaign' | 'adset' | 'ad' | 'empreendimento' | 'form'
--    p_janela_dias: só conta o marco se aconteceu até N dias depois do lead entrar
--    Leads com menos de p_janela_dias de vida ficam de fora (maturidade).
-- ------------------------------------------------------------
create or replace function public.midia_funil(
  p_since date,
  p_until date,
  p_nivel text default 'campaign',
  p_janela_dias integer default 14,
  p_canal text default 'meta'
)
returns table (
  chave text,
  nome text,
  campaign_id text,
  adset_id text,
  ad_id text,
  leads bigint,
  contatados bigint,
  sem_contato bigint,
  qualificados bigint,
  visitas_marcadas bigint,
  visitas_realizadas bigint,
  no_shows bigint,
  negocios bigint,
  vendas bigint,
  descartados bigint,
  vgv numeric,
  spend numeric,
  impressions bigint,
  cpl numeric,
  custo_por_visita numeric,
  custo_por_venda numeric,
  taxa_visita numeric
)
language sql
stable
security invoker
set search_path = public
as $$
with j as (
  select *
  from public.v_midia_lead_jornada
  where created_at >= (p_since::timestamp at time zone 'America/Sao_Paulo')
    and created_at <  ((p_until + 1)::timestamp at time zone 'America/Sao_Paulo')
    and created_at <= now() - make_interval(days => p_janela_dias)
    and canal = p_canal
),
leads as (
  select
    case p_nivel
      when 'campaign' then coalesce(campaign_id, campanha, 'sem campanha')
      when 'adset'    then coalesce(conjunto_anuncio, 'sem conjunto')
      when 'ad'       then coalesce(ad_id, anuncio, 'sem anúncio')
      when 'empreendimento' then coalesce(empreendimento, 'sem empreendimento')
      when 'form'     then coalesce(form_id, formulario, 'sem formulário')
      else coalesce(campaign_id, campanha, 'sem campanha') end as chave,
    case p_nivel
      when 'campaign' then max(campanha)
      when 'adset'    then max(conjunto_anuncio)
      when 'ad'       then max(anuncio)
      when 'empreendimento' then max(empreendimento)
      when 'form'     then max(coalesce(form_name, formulario))
      else max(campanha) end as nome,
    max(campaign_id) as campaign_id,
    null::text as adset_id,
    max(ad_id) as ad_id,
    count(*) as leads,
    count(*) filter (where primeiro_contato_em is not null and primeiro_contato_em <= created_at + make_interval(days => p_janela_dias)) as contatados,
    count(*) filter (where sem_contato) as sem_contato,
    count(*) filter (where qualificado_em is not null and qualificado_em <= created_at + make_interval(days => p_janela_dias)) as qualificados,
    count(*) filter (where visita_marcada_em is not null and visita_marcada_em <= created_at + make_interval(days => p_janela_dias)) as visitas_marcadas,
    count(*) filter (where visita_realizada_em is not null and visita_realizada_em <= (created_at + make_interval(days => p_janela_dias))::date) as visitas_realizadas,
    count(*) filter (where teve_no_show) as no_shows,
    count(*) filter (where negocio_em is not null and negocio_em <= created_at + make_interval(days => p_janela_dias)) as negocios,
    count(*) filter (where venda_em is not null) as vendas,
    count(*) filter (where descartado) as descartados,
    coalesce(sum(vgv_rateado), 0) as vgv
  from j
  group by 1
),
gasto as (
  select
    case p_nivel
      when 'campaign' then campaign_id
      when 'adset'    then adset_name
      when 'ad'       then ad_id
      else null end as chave,
    sum(spend) as spend,
    sum(impressions) as impressions
  from public.midia_snapshot_diario
  where canal = p_canal and dia between p_since and p_until
    and p_nivel in ('campaign','adset','ad')
  group by 1
)
select
  l.chave, l.nome, l.campaign_id, l.adset_id, l.ad_id,
  l.leads, l.contatados, l.sem_contato, l.qualificados, l.visitas_marcadas, l.visitas_realizadas,
  l.no_shows, l.negocios, l.vendas, l.descartados, l.vgv,
  g.spend, g.impressions,
  case when l.leads > 0 then round(g.spend / l.leads, 2) end as cpl,
  case when l.visitas_realizadas > 0 then round(g.spend / l.visitas_realizadas, 2) end as custo_por_visita,
  case when l.vendas > 0 then round(g.spend / l.vendas, 2) end as custo_por_venda,
  case when l.leads > 0 then round(100.0 * l.visitas_realizadas / l.leads, 1) end as taxa_visita
from leads l
left join gasto g on g.chave = l.chave
order by l.leads desc;
$$;

comment on function public.midia_funil is 'Uhome Mídia: funil por campanha/conjunto/anúncio/empreendimento/formulário com janela de maturidade. Só conta o marco se aconteceu até N dias após o lead entrar; leads mais novos que N dias ficam de fora.';

-- ------------------------------------------------------------
-- 7. Cron: sincronização horária (últimos 3 dias + criativos)
--    IMPORTANTE: pg_net tem timeout padrão de 5 s. Sync de insights
--    demora mais que isso, então SEMPRE passar timeout_milliseconds.
-- ------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'midia-sync-hourly';
select cron.schedule(
  'midia-sync-hourly',
  '20 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/midia-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'capi_cron_secret')
    ),
    body := jsonb_build_object('mode', 'all', 'days', 3),
    timeout_milliseconds := 300000
  );
  $cron$
);

-- ------------------------------------------------------------
-- 8. Conserto do cron antigo meta-ads-sync-daily (parado desde 16/08/2026):
--    a chamada caía no timeout de 5 s do pg_net antes de a função terminar.
--    Mesmo job, mesma hora, agora com 5 minutos de tolerância.
-- ------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'meta-ads-sync-daily';
select cron.schedule(
  'meta-ads-sync-daily',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/meta-ads-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'capi_cron_secret')
    ),
    body := jsonb_build_object('mode', 'sync'),
    timeout_milliseconds := 300000
  );
  $cron$
);
