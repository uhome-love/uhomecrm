# CAPI da Uhome — limpeza de payload, auditoria e detecção

Independente da Lia. Só o Bloco 2 é execução de código; o resto é levantamento e observabilidade.

## Levantamento fechado (leitura feita agora, nada alterado)

**Duplicidade (item 1) — não há inflação relevante.** O `_trg_pipeline_lead_capi()` dispara em **toda** transição para a etapa Qualificação (`NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id = <uuid Qualificação>`), não só na primeira — então repetição é possível por desenho. Na prática, nos últimos 14 dias: **401 eventos `LeadQualificado` para 398 leads distintos** (recomputei o `event_id` md5 para cruzar). Só 3 leads geraram evento repetido. A conta que não fechava era outra: os 82 eventos sem `lead_id` não vêm só de leads criados nos últimos 14 dias — a maioria é de lead antigo reativado.

**Origem dos 82 `LeadQualificado` sem `lead_id` (14 dias):**

| Origem | Eventos |
|---|---|
| Reengajamento | 39 |
| meta_ads | 16 |
| imovelweb | 6 |
| Oferta Ativa | 5 |
| Facebook Leads Ads | 4 |
| site_uhome | 3 |
| Manual | 3 |
| outro / Formulário / Nutrição / Open Bosque / não informado | 6 |

Leitura: ~20 são de origem Meta (`meta_ads` + `Facebook Leads Ads`) e perderam o `meta_lead_id` — lead antigo, anterior à captura do identificador. Os 39 de Reengajamento são leads velhos de base, também sem identificador. O restante (~23) é claramente não-Meta.

**CEP — encerrado.** Campo real (vem de `pipeline_leads.cep`), mas vazio em 1.410 de 1.410 leads dos últimos 30 dias, e o formulário do Meta só coleta nome, telefone e e-mail. Com `lead_id` presente a correspondência já é a melhor possível. Não se persegue CEP. Registrado e encerrado.

**Cidade/estado — fixos no código.** `v_cidade := 'porto alegre'` e `v_uf := 'rs'` para todo lead, sempre. Dado falso.

**IP e user-agent — do servidor.** Nos últimos 14 dias os únicos valores gravados são `Deno/2.1.4 (SupabaseEdgeRuntime)` (477) e `Make/production` (6).

## Riscos e regras registradas

**Regra permanente — IP/UA não existem para lead de anúncio.** Em formulário instantâneo o lead nunca toca a infraestrutura da Uhome: preenche dentro do Instagram. `client_ip_address` e `client_user_agent` não são pendência a resolver. Proibido inventar valor ou "reativar" a captura. O identificador desse fluxo é o `lead_id`.

**Risco conhecido — trigger de Qualificação dispara em toda transição.** `_trg_pipeline_lead_capi()` dispara sempre que `stage_id` muda para a etapa Qualificação, não só na primeira vez. Hoje o impacto é desprezível (3 repetições em 14 dias) e **não vale corrigir agora**. Fica registrado para o dia em que alguém reorganizar o board em massa ou rodar backfill de etapas — nesse dia isso vira conversão duplicada em volume.

## Pré-condição verificada — captura de `meta_lead_id` está verde

Leads criados nos últimos 7 dias, por origem:

| Origem | Criados | Com `meta_lead_id` |
|---|---|---|
| ig | 305 | 305 |
| fb | 56 | 56 |
| meta_backfill | 11 | 11 |
| meta_ads | 5 | 5 |
| Reengajamento / imovelweb / Oferta Ativa / site_uhome / outro | 25 | 0 |

**377 de 377 leads de origem Meta têm identificador — 100%, zero dias com falha na semana.** A ingestão não está perdendo `lead_id` de lead novo, então a guarda só barra lead antigo e lead não-Meta. Verde: pode subir.

## Bloco 2 · Guarda de `meta_lead_id` + limpeza do payload (execução)

Uma migration (DDL: substitui a função, adiciona colunas):

1. **Guarda dura: sem `meta_lead_id`, o evento não entra na fila.** Vale para os quatro eventos da escada (`LeadQualificado`, `VisitaMarcada`, `VisitaRealizada`, `Venda`), independentemente da origem do lead. A função sai cedo antes de enfileirar.
2. **O barramento é medido.** Cada bloqueio grava uma linha em `ops_events` (`event_type = 'capi_bloqueado_sem_lead_id'`) com o id interno do lead, o nome do evento, a `origem` e a data de criação do lead. Assim dá para separar lead velho de lead novo depois.
3. **`ct`/`st` deixam de ser fixos.** Só entram se houver cidade/UF reais no cadastro; senão, omitidos. `country` (`br`) fica, porque é verdadeiro.
4. **`client_ip_address`/`client_user_agent` só entram se forem do cliente.** Filtro descarta `Deno/`, `SupabaseEdgeRuntime`, `Make/` e vazio. Hoje isso zera os dois campos, e é o resultado correto.
5. **Nova coluna `lead_id_interno uuid` em `meta_capi_queue`** (aditiva, sem backfill), preenchida em todo evento novo. Torna trivial auditoria futura de origem, duplicidade e cobertura sem recomputar md5.
6. Nada mais muda: hashes de e-mail/telefone/nome, `fbc`/`fbp`, `lead_id`, trava de 7 dias e `event_id` ficam idênticos.

**Efeito esperado, para não ser confundido com falha:** queda de ~20% no volume de `LeadQualificado` e piora aparente do custo por resultado no Gerenciador. É o número deixando de ser inflado, não a correção quebrando.

### `meta-capi-track` — desativar, não limpar

A fila tem **7 eventos com `action_source: website` em toda a história**, e só **1 é de fato do site** (ViewContent, 30/07, que foi o teste de implantação). Os outros 6 são do CRM, de 28/07. **Nenhuma chamada real em 30 dias.** Como não existe site, a função é um caminho de eventos sem guarda esperando alguém reativar sem lembrar da regra. Proposta: **remover a edge function `meta-capi-track`** em vez de limpar `ct`/`st` nela. Se um dia existir site, ela volta já nascendo com a guarda.

## Bloco 3 · Detecção (migration própria, separada da Lia)

Migration **distinta** da Fase 0 da Lia — se uma falhar, a outra não volta junto.

- **Alerta de evento silencioso**: evento que vinha chegando e fica >6h sem chegar (dedup 24h por nome de evento), no padrão do `edge_health_aggregate`.
- **Alerta de campanha gastando sem lead** em 6h.
- **Alerta de guarda barrando lead recente**: bloqueios de leads **criados nos últimos 7 dias e de origem Meta** acima de 3 em 24h dispara alerta. Lead velho barrado é o comportamento esperado e fica silencioso; lead novo de Meta barrado é bug de ingestão e precisa avisar.
- **Canal: in-app e push.** Os três alertas existem para o tipo de falha que ninguém percebe — alerta que só vive dentro do sistema depende de alguém abrir a tela, que é exatamente o que não aconteceu no webhook parado de 15/06 a 13/07. Push via `push_subscriptions` para admins, in-app via `notifications`.
- **Painel** em `/admin/ingestao`: eventos por dia por tipo, cobertura de `lead_id`, taxa de descarte da fila e **contador de bloqueados sem `meta_lead_id`, separado entre lead antigo e lead recente de Meta**.

## Medição, com prazo realista

- **48h após o Bloco 2**: cobertura de campo nos **eventos novos** — quantos saíram sem cidade/estado fixos, quantos sem IP/UA de servidor, cobertura de `lead_id` (esperado: 100%) e quantos leads foram barrados, por origem.
- **7 dias após**: reavalio o `pixel_has_low_event_source_match_rate` no Diagnóstico, porque ele é calculado sobre janela e 48h não bastam para virar o indicador.

## Fora deste plano (seu, manual)

O conjunto **ativo, em outra campanha, ainda otimizando por `SCHEDULE`** — evento que ninguém dispara desde 06/08. Dois minutos no Gerenciador. Depois os dois conjuntos da campanha da Lia (pausada).

Também fora: enriquecer dados de usuário, valor monetário no evento de Venda, e qualquer coisa da Lia além da Fase 0 já combinada.

