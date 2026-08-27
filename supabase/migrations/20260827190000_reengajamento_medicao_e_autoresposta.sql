-- Reengajamento: fechar as 3 cegueiras de medição + marcar autoresposta de empresa.
--
-- PROBLEMA (auditado em 27/08/2026, lote "Reengajar nao_atende · cardápio"):
--   163 disparos, e o painel mostra 0 resposta. Motivos:
--   1. `respondeu_em` existe na tabela e NENHUM código escreve nela;
--   2. o webhook do 360dialog descarta os eventos de status (entregue/lido/falhou),
--      então não se sabe nem se a mensagem chegou;
--   3. das 3 "respostas" reais, 2 eram autoresposta de empresa (um salão de estética e
--      uma escolinha de futebol). A LIA respondeu aos robôs como se fossem clientes,
--      abriu janela de 24h e chegou a mandar material. Resposta humana real: 1 em 163.
--
-- Esta migration só ADICIONA colunas e recria a view de elegíveis. Não apaga nada.

-- 1) Rastreio de entrega e de resposta na fila de disparo -------------------------------
alter table public.lia_reengajamento_fila
  add column if not exists wa_message_id text,      -- id da mensagem no WhatsApp (casa o status)
  add column if not exists entregue_em  timestamptz,
  add column if not exists lido_em      timestamptz,
  add column if not exists falhou_em    timestamptz,
  add column if not exists falha_motivo text,
  add column if not exists resposta_tipo text;      -- 'humano' | 'autoresposta'

comment on column public.lia_reengajamento_fila.wa_message_id is
  'ID da mensagem no WhatsApp devolvido pelo 360dialog no disparo. É por ele que o webhook casa os eventos de entregue/lido/falhou.';
comment on column public.lia_reengajamento_fila.resposta_tipo is
  'humano = pessoa de verdade respondeu. autoresposta = robô institucional (horário de atendimento, "em breve retornaremos"). Autoresposta NÃO conta como resposta.';

create index if not exists idx_lia_reeng_fila_wamid
  on public.lia_reengajamento_fila (wa_message_id) where wa_message_id is not null;
create index if not exists idx_lia_reeng_fila_tel8_enviado
  on public.lia_reengajamento_fila (tel8, enviado_em desc) where status = 'enviado';

-- 2) Elegíveis: mapear produto_slug para TODO o cardápio -------------------------------
-- Antes só Casa Tua POA, Casa Tua Canoas e AWA tinham slug. Os outros caíam em NULL, então
-- o modo "Produto (direciona)" não alcançava, por exemplo, os 912 leads mortos do Open Bosque,
-- que são justamente o público do Open Bosque.
create or replace view public.lia_reengajamento_elegiveis as
with base as (
  select p.id as pipeline_lead_id, p.nome, p.telefone, p.empreendimento,
         p.motivo_descarte, p.motivo_descarte_code, p.tipo_descarte, p.observacoes,
         p.stage_changed_at, p.created_at,
         "right"(regexp_replace(p.telefone, '\D', '', 'g'), 8) as tel8
  from public.pipeline_leads p
  where p.arquivado = true
    and p.telefone is not null
    and length(regexp_replace(p.telefone, '\D', '', 'g')) >= 10
    and coalesce(p.tipo_descarte, '') <> 'definitivo'
    and coalesce(p.motivo_descarte_code, '') <> all (array[
      'nao_quer_contato','lgpd','contato_invalido','comprou_outro','duplicado','sem_condicao_financeira'])
    and coalesce(p.reengajamento_status, '') <> all (array[
      'respondeu_nao','respondeu_nao_wave2','respondido_nao','telefone_invalido'])
), sem_vivo as (
  select b.* from base b
  where not exists (
    select 1 from public.pipeline_leads v
    where v.arquivado = false
      and "right"(regexp_replace(v.telefone, '\D', '', 'g'), 8) = b.tel8)
    and not exists (
    select 1 from public.lia_estado le
    where "right"(regexp_replace(le.telefone, '\D', '', 'g'), 8) = b.tel8
      and le.optout = true)
), dedup as (
  select distinct on (tel8) *
  from sem_vivo
  order by tel8, stage_changed_at desc nulls last, created_at desc
)
select
  pipeline_lead_id, nome, telefone, tel8, empreendimento, observacoes,
  case
    when motivo_descarte_code = 'sem_interesse_momento'
      or motivo_descarte ilike '%interesse no momento%'            then 'sem_interesse_momento'
    when motivo_descarte_code = 'reengajavel'                      then 'reengajavel'
    when motivo_descarte_code is null
      and (motivo_descarte is null or btrim(motivo_descarte) = '') then 'sem_motivo'
    when motivo_descarte_code = 'nao_atende'
      or motivo_descarte ilike '%não atende%'                      then 'nao_atende'
    else coalesce(motivo_descarte_code, 'outro')
  end as balde,
  case
    when empreendimento ilike '%casa tua%porto%'
      or empreendimento ilike '%alto petrop%'      then 'casa-tua-porto-alegre'
    when empreendimento ilike '%santos ferr%'
      or empreendimento ilike '%casa tua%canoas%'  then 'casa-tua-canoas'
    when empreendimento ilike '%awa%'              then 'awa-wellness'
    when empreendimento ilike '%flow%'             then 'flow'
    when empreendimento ilike '%open bosque%'      then 'open-bosque'
    when empreendimento ilike '%the arch%'
      or empreendimento ilike '%thearch%'          then 'the-arch'
    when empreendimento ilike '%baikal%'           then 'lake-baikal'
    when empreendimento ilike '%connect%'          then 'connect-joao-wallig'
    else null
  end as produto_slug,
  (empreendimento ilike '%casa tua%porto%' or empreendimento ilike '%alto petrop%'
    or empreendimento ilike '%santos ferr%' or empreendimento ilike '%casa tua%canoas%'
    or empreendimento ilike '%awa%' or empreendimento ilike '%flow%'
    or empreendimento ilike '%open bosque%' or empreendimento ilike '%the arch%'
    or empreendimento ilike '%thearch%' or empreendimento ilike '%baikal%'
    or empreendimento ilike '%connect%') as produto_ativo,
  stage_changed_at, created_at
from dedup;

-- 3) O painel de resultados que faltava -------------------------------------------------
-- Um lote por linha, do disparo até a venda. É esta view que a aba Reengajamento deve ler.
create or replace view public.lia_reengajamento_resultados as
select
  r.id                as run_id,
  r.nome,
  r.modo,
  r.status            as run_status,
  r.filtro ->> 'balde' as balde,
  r.produto_slug,
  r.lote_total,
  r.cap_dia,
  r.criado_em,
  r.iniciado_em,
  count(f.*)                                                              as na_fila,
  count(*) filter (where f.status = 'enviado')                            as enviados,
  count(*) filter (where f.status = 'pendente')                           as pendentes,
  count(*) filter (where f.entregue_em is not null)                       as entregues,
  count(*) filter (where f.lido_em is not null)                           as lidos,
  count(*) filter (where f.falhou_em is not null)                         as falhas,
  count(*) filter (where f.respondeu_em is not null)                      as responderam,
  count(*) filter (where f.resposta_tipo = 'humano')                      as responderam_humano,
  count(*) filter (where f.resposta_tipo = 'autoresposta')                as autorespostas,
  -- funil depois da resposta, casando pelo lead que a LIA ressuscitou
  count(*) filter (where exists (
    select 1 from public.lia_estado e
    where "right"(regexp_replace(e.telefone, '\D', '', 'g'), 8) = f.tel8
      and e.qualificado_em is not null))                                  as qualificados,
  count(*) filter (where exists (
    select 1 from public.lia_estado e
    where "right"(regexp_replace(e.telefone, '\D', '', 'g'), 8) = f.tel8
      and e.repassado_em is not null))                                    as repassados,
  count(*) filter (where exists (
    select 1 from public.lia_estado e
    where "right"(regexp_replace(e.telefone, '\D', '', 'g'), 8) = f.tel8
      and e.optout = true))                                               as optouts,
  count(*) filter (where exists (
    select 1 from public.visitas v
    join public.pipeline_leads pl on pl.id = v.pipeline_lead_id
    where "right"(regexp_replace(pl.telefone, '\D', '', 'g'), 8) = f.tel8
      and v.created_at >= f.enviado_em))                                  as geraram_visita
from public.lia_reengajamento_runs r
left join public.lia_reengajamento_fila f on f.run_id = r.id
group by r.id, r.nome, r.modo, r.status, r.filtro, r.produto_slug,
         r.lote_total, r.cap_dia, r.criado_em, r.iniciado_em;

comment on view public.lia_reengajamento_resultados is
  'Um lote por linha, do disparo até a visita. responderam_humano exclui autoresposta de empresa; é esse o número que vale.';

revoke all on public.lia_reengajamento_resultados from anon;
grant select on public.lia_reengajamento_resultados to authenticated;
revoke all on public.lia_reengajamento_elegiveis from anon;
grant select on public.lia_reengajamento_elegiveis to authenticated;
