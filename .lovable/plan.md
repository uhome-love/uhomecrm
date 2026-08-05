# Por que "Leads" > "Resultados" no Meta Ads (e como zerar a duplicação)

## O que a investigação mostrou (dados reais, últimos 7 dias)

| Evento enviado pelo CRM | Eventos | Leads únicos |
|---|---|---|
| `Lead` | 360 | 355 |
| `LeadQualificado` | 267 | 266 |
| `Schedule` | 84 | 75 |
| `ViewContent` | 50 | 41 |
| `Purchase` | 1 | 1 |

Respostas diretas às suas perguntas:

1. **Quando o gatilho `_trg_pipeline_lead_capi_insert` dispara:** apenas em `AFTER INSERT` de `pipeline_leads`, uma vez por linha criada. Ele não dispara em edição, mudança de etapa ou reabertura. Ignora leads já arquivados e leads sem e-mail, telefone e `meta_lead_id`.
2. **Duplicação por lead:** praticamente inexistente — 5 leads em 360 eventos, e nesses casos os dois eventos estão separados por dias, ou seja, foram **duas linhas diferentes criadas no pipeline** para o mesmo contato (recriação/backfill), não o mesmo lead disparando duas vezes. O `event_id` é único por lead+evento+timestamp com `ON CONFLICT DO NOTHING`, então re-enfileiramento no mesmo segundo não duplica.
3. **`meta_lead_id`:** preenchido em 100% dos leads de formulário nativo (`ig` 282/282, `fb` 27/27, `meta_backfill` 14/14). Ficam sem `meta_lead_id` exatamente os leads que **não** vieram de formulário Meta: Manual (7), site_uhome (5), imovelweb (4), outro (4), Reengajamento (3), Oferta Ativa (3), indicação (1) — e mesmo assim o CRM manda `Lead` para todos eles.
4. **Causa raiz da diferença "Leads" vs "Resultados":** o CRM envia um evento `Lead` por CAPI para **todo lead novo**, inclusive para os que a Meta **já contou** pelo formulário nativo. A Meta não deduplica esses dois registros (o evento do CRM tem `event_id` próprio, gerado pelo banco, que nunca coincide com o evento do formulário nativo). Resultado: cada lead de formulário é contado duas vezes na coluna "Leads" — uma pelo formulário, outra pelo CAPI — mais os leads de origem não-Meta, que não deveriam contar em nenhuma campanha. A coluna "Resultados" continua contando só o evento de otimização (formulário nativo / lead qualificado), por isso fica menor.

## O que muda

Uma única migração alterando a função `public._trg_pipeline_lead_capi_insert()`:

- **Parar de enviar o evento `Lead` para leads que vieram de formulário Meta** (`meta_lead_id` preenchido) — a Meta já os conta pelo formulário nativo.
- **Parar de enviar `Lead` para origens não-Meta** (Manual, site, ImovelWeb, indicação, Reengajamento, Oferta Ativa) — esses leads não pertencem a nenhuma campanha e só inflam a métrica.
- Na prática, o evento `Lead` do CRM deixa de ser emitido; o sinal de qualidade que o CRM manda para a Meta passa a ser só `LeadQualificado`, `Schedule`, `ViewContent` e `Purchase`, que são exatamente os eventos que o formulário nativo não tem como enviar.

Nada de reprocessamento ou reenvio de histórico. Os eventos já enviados continuam no relatório da Meta; o alinhamento entre "Leads" e "Resultados" aparece a partir do dia seguinte à aplicação.

## Fora de escopo

- Gatilho de qualificação (`_trg_pipeline_lead_capi`), `Schedule`, `ViewContent`, `Purchase` — permanecem como estão.
- `enqueue_meta_capi_event`, tabela `meta_capi_queue`, dispatcher e endpoint público `meta-capi-track`.
- Frontend: nenhuma alteração.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi_insert()`.
  - Corpo passa a ser um `RETURN NEW` imediato (nenhum enfileiramento de `Lead`), preservando o bloco `EXCEPTION WHEN OTHERS` com log em `ops_events` do restante do fluxo, conforme a regra "rastreamento nunca derruba entrada de lead".
  - O gatilho `trg_pipeline_lead_capi_insert` continua existindo (não será dropado), para reversão em uma linha caso você queira voltar atrás.
- Custo de dedup: os 5 casos de contato recriado no pipeline deixam de importar, já que `Lead` não é mais emitido.

## Alternativa, se você preferir manter um sinal de entrada

Em vez de eliminar o `Lead`, é possível renomeá-lo para um evento customizado (ex.: `LeadCRM`), que **não** soma na coluna "Leads" da Meta e serve só para conferência interna. Diga qual das duas opções prefere antes de eu aplicar.
