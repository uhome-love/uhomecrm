# CAPI: separar "Lead" (entrada) de "LeadQualificado" (qualificação)

## Como está hoje (verificado no banco)

Quatro gatilhos alimentam a fila `meta_capi_queue`, que o dispatcher envia ao Meta:

| Momento | Evento enviado hoje | Volume (7 dias) |
|---|---|---|
| Lead criado no CRM (formulário Meta, site, etc.) | `Lead` (fonte "uhome CRM") | 343 |
| Lead entra em **Em Negociação** | `Lead` (fonte "Qualificado") | 11 |
| Visita marcada | `Schedule` | 84 |
| Visita realizada | `ViewContent` | 49 |
| Negócio ganho | `Purchase` | 1 |

Dois pontos importantes que corrigem a hipótese inicial:

1. O evento `Lead` **já dispara na entrada do lead no CRM**, independente da etapa. O Meta não está perdendo leads.
2. O problema real é o oposto: o evento de qualificação **também se chama `Lead`**, então ele soma em cima da métrica de leads do Meta (duplicação por contato que avança). E ele está amarrado ao stage **Em Negociação**, não ao de Qualificação.

## O que muda

Uma única migração, alterando apenas a função `public._trg_pipeline_lead_capi()`:

- Passa a disparar quando o lead entra na etapa **Qualificação** (em vez de Em Negociação).
- O evento passa a se chamar **`LeadQualificado`** (evento customizado), em vez de `Lead`.
- Mantém a proteção atual: qualquer erro no envio é registrado em `ops_events` e nunca derruba a movimentação do lead.

Resultado: `Lead` volta a significar exatamente "contato novo entrou no CRM", e `LeadQualificado` vira o sinal de qualidade que ensina o algoritmo do Meta quais perfis viram lead bom.

## Fora de escopo (não será tocado)

- Gatilho de criação de lead (`_trg_pipeline_lead_capi_insert`) — já está correto.
- Eventos `Schedule` (visita marcada), `ViewContent` (visita realizada) e `Purchase` (venda).
- Função `enqueue_meta_capi_event`, tabela `meta_capi_queue`, dispatcher e demais edge functions.
- Nenhum dado histórico é reprocessado ou reenviado.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi()`.
  - Condição: `NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id = '1ea43190-44c8-43ec-91b4-409b055b0e58'` (Qualificação).
  - Chamada: `enqueue_meta_capi_event(p_lead_id => NEW.id, p_event_name => 'LeadQualificado', p_event_time => now(), p_custom_data => '{}'::jsonb, p_lead_event_source => 'Qualificado')`.
  - Bloco `EXCEPTION WHEN OTHERS` preservado, com log em `ops_events`.
- O gatilho `trg_pipeline_lead_capi` em `pipeline_leads` continua o mesmo; só o corpo da função muda.
- Deduplicação continua garantida pelo `event_id` (hash de lead + evento + fonte + timestamp) com `ON CONFLICT DO NOTHING`.
- Sem alteração de frontend, sem tabela nova, sem deploy de edge function.

## Depois de aplicar (do lado do Meta, feito por você)

`LeadQualificado` é evento customizado: para usá-lo como otimização ou coluna de relatório, ele precisa ser registrado como conversão personalizada no Gerenciador de Eventos do dataset. Ele começa a aparecer lá assim que o primeiro lead entrar em Qualificação após a migração.
