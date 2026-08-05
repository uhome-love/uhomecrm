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
- Na prática, o evento `Lead` do CRM deixa de ser emitido; o CRM manda só o que aconteceu **depois** da entrada, que é o que o formulário nativo não tem como saber.

## Nomes dos eventos em português

Hoje os eventos usam os nomes padrão do Meta, que são pouco intuitivos. Passam a ter nome próprio, autoexplicativo:

| Hoje | Passa a ser | Quando dispara |
|---|---|---|
| `Lead` | (deixa de existir) | — |
| `LeadQualificado` | `LeadQualificado` (mantém) | Lead entra na etapa Qualificação |
| `Schedule` | `VisitaMarcada` | Visita agendada |
| `ViewContent` | `VisitaRealizada` | Visita confirmada como realizada (era o nome genérico "viu conteúdo") |
| `Purchase` | `Venda` | Negócio ganho / contrato assinado |

Ponto importante antes de aprovar: `Schedule`, `ViewContent` e `Purchase` são eventos **padrão** do Meta e podem ser usados direto como objetivo de otimização de campanha. Renomeando, os quatro viram eventos **customizados** — continuam aparecendo no Gerenciador de Eventos e podem ser usados como otimização, mas exigem cadastro de conversão personalizada no dataset, e o histórico dos nomes antigos não é migrado (o gráfico recomeça com o nome novo). Se você usa hoje `Purchase` como evento de otimização em alguma campanha, ela precisa ser reapontada.

## Fora de escopo

- `enqueue_meta_capi_event`, tabela `meta_capi_queue`, dispatcher e endpoint público `meta-capi-track` (o endpoint do site continua aceitando os nomes padrão).
- Frontend: nenhuma alteração.
- Nenhum dado histórico é reprocessado ou reenviado.

## Detalhes técnicos

- Uma única migração, alterando 3 funções de gatilho:
  - `_trg_pipeline_lead_capi_insert()` → corpo vira `RETURN NEW` imediato (não enfileira mais `Lead`). O gatilho não é dropado, para reversão em uma linha.
  - `_trg_visita_capi()` → `Schedule` vira `VisitaMarcada`, `ViewContent` vira `VisitaRealizada`.
  - `_trg_negocio_capi()` → `Purchase` vira `Venda`.
- Todos preservam o bloco `EXCEPTION WHEN OTHERS` com log em `ops_events`, conforme a regra "rastreamento nunca derruba entrada de lead".
- Deduplicação segue pelo `event_id` (hash lead + evento + timestamp) com `ON CONFLICT DO NOTHING`.

## Princípio acordado

O Meta já sabe quem preencheu o formulário — não precisa que o CRM repita essa informação. O CRM passa a mandar **só o que evoluiu e qualificou** depois da entrada: `LeadQualificado`, `VisitaMarcada`, `VisitaRealizada` e `Venda`.
