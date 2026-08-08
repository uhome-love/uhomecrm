# CAPI da Uhome — limpeza de payload, levantamento de origem e detecção

Independente da Lia. Só o Bloco 2 (payload) é execução de código; o resto é levantamento e observabilidade.

## O que já confirmei lendo banco e código agora

- O payload é montado **inteiramente** em `public.enqueue_meta_capi_event` (Postgres). Nenhuma edge function monta `user_data`, exceto `meta-capi-track` (site, hoje sem uso real).
- **Cidade/estado são fixos no código**: a função define `v_cidade := 'porto alegre'` e `v_uf := 'rs'` para todo lead, sempre. Confirmado — é dado falso, não dado faltando.
- **IP e user-agent são do servidor**: a função lê `pipeline_leads.client_user_agent`/`client_ip_address`, e nos últimos 14 dias esses campos só contêm `Deno/2.1.4 (SupabaseEdgeRuntime)` (477 leads) e `Make/production` (6). Ou seja, 100% do que existe gravado é servidor, não cliente.
- **Cobertura de `lead_id`** (14 dias, na fila): LeadQualificado 318/400 (79,5%), Lead 453/507, VisitaMarcada 32/37, VisitaRealizada 8/12, Venda 1/5.
- **Pista de origem** (ainda não é a resposta final): dos leads criados nos últimos 14 dias sem `meta_lead_id`, a origem é Manual 14, Reengajamento 10, Oferta Ativa 9, site_uhome 9, imovelweb 8, outro 4, indicação 1 e **meta_ads 1**. Indica fortemente que os eventos sem `lead_id` são de leads que não vieram do Meta — mas o cruzamento evento↔lead ainda não foi feito (o `event_id` é um md5 e não guarda o id do lead), então isso entra como levantamento formal antes de qualquer correção.
- A trava de 7 dias e o `event_id` como chave de idempotência estão corretos e não serão tocados.

## Bloco 1 · Levantamento da origem dos eventos sem `lead_id` (sem corrigir nada)

Cruzar os `LeadQualificado` dos últimos 14 dias sem `lead_id` com o lead de origem, recomputando o `event_id` (md5 determinístico) para cada lead candidato, e devolver a quebra por `origem`, separando:

- leads que **não vieram do Meta** (site, ImovelWeb, indicação, manual, oferta ativa, reengajamento) — recomendação será parar de disparar;
- leads que **vieram do Meta** mas perderam o `meta_lead_id` na ingestão — aí é bug de ingestão e conserta na entrada.

Entrego a tabela e a recomendação. Nenhuma mudança de comportamento neste bloco — as duas correções são opostas e a decisão é sua.

## Bloco 2 · Limpeza do payload (execução)

Uma migration que substitui `enqueue_meta_capi_event`, mudando só a montagem do `user_data`:

1. **`ct`/`st` deixam de ser fixos.** Só entram se houver cidade/UF reais no cadastro do lead; caso contrário, omitidos. `country` (`br`) fica, porque é verdadeiro.
2. **`client_ip_address` e `client_user_agent` só entram se forem do cliente.** Filtro em código: descarta valores de servidor (`Deno/`, `SupabaseEdgeRuntime`, `Make/`, vazio) e, na prática, hoje isso zera os dois campos até a ingestão passar a capturar o valor real do navegador.
3. Tudo o mais (hashes de e-mail, telefone, nome, CEP, `fbc`/`fbp`, `lead_id`, trava de 7 dias, `event_id`) fica idêntico.

Mesma limpeza aplicada em `supabase/functions/meta-capi-track/index.ts`, que também manda `ct`/`st` fixos.

## Bloco 3 · Detecção (junto com a Fase 0 da Lia)

Vai na mesma migration da Fase 0 da Lia, para não gastar janela de migration:

- **Alerta de evento silencioso**: evento que vinha chegando e fica >6h sem chegar gera alerta (dedup 24h por evento), no mesmo padrão do `edge_health_aggregate` já existente.
- **Alerta de campanha gastando sem lead**: campanha ativa com gasto e zero lead em 6h.
- **Painel** em `/admin/ingestao`: eventos por dia por tipo, cobertura de `lead_id` e taxa de descarte da fila.

Canal do alerta: definido por você (só no sistema, ou também push no celular).

## Fora deste plano

Bloco 2 do seu documento (trocar os conjuntos de `SCHEDULE` para `LeadQualificado` e consolidar os seis conjuntos da Lia em dois) é manual no Gerenciador de Anúncios. Também ficam de fora: enriquecer dados de usuário, valor monetário no evento de Venda e qualquer coisa da Lia além da Fase 0.

## Medição (48h depois do Bloco 2)

Rodo de novo o Diagnóstico do dataset e reporto se `pixel_has_low_event_source_match_rate` saiu de reprovado, mais a cobertura de `lead_id` só nos eventos posteriores à limpeza.
