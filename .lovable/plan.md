# VisitaMarcada — auditoria da cobertura (o furo não é o que parecia)

## (a) Como o VisitaMarcada é disparado hoje

Não é por mudança de etapa do lead. Já existe trigger **na própria tabela `visitas`**:

```text
trg_visita_capi  AFTER INSERT OR UPDATE OF status ON public.visitas
  → public._trg_visita_capi()
      status = 'marcada'  → enqueue_meta_capi_event(..., 'VisitaMarcada',
                              custom_data = {visita_id, data_visita, empreendimento})
      status = 'realizada'→ 'VisitaRealizada'
```

Ou seja, **o fix proposto (trigger AFTER INSERT em `visitas`) já está implementado em produção**. Criar outro trigger duplicaria evento sem cobrir nada novo.

Existe também um caminho paralelo da Lia (`trg_ia_apresentacao_capi` → `enqueue_meta_capi_event_lia`), que não interfere aqui.

## (b) Causa real das visitas sem evento

Auditoria das visitas criadas desde 05/08 (85 linhas, 20 sem evento):

| Motivo | Qtde | Natureza |
|---|---|---|
| Visita criada **antes de 05/08 19:24**, quando o evento ainda se chamava `Schedule` | 3 | Falso furo — o evento existe, com outro nome |
| Lead **sem `meta_lead_id`** → bloqueado pela guarda da `enqueue_meta_capi_event` | 17 | Comportamento intencional |
| `pipeline_lead_id` nulo | 0 | — |
| Visita inserida já com status ≠ 'marcada' | 0 | — |

Confirmado: **nenhuma visita foi perdida por “lead não mudou de etapa”**. A guarda da `enqueue_meta_capi_event` (regra fixa do projeto: sem `meta_lead_id` o evento não entra na fila) é a única causa dos 17.

Origem dos 17 bloqueados: reengajamento 4, manual 3, oferta ativa 3, meta_ads 3, facebook leads ads 1, site/indicação 3.

- **13 deles não são de anúncio Meta** (manual, indicação, site, oferta ativa, reengajamento). Não têm o que casar no Meta — enviar inflaria o volume sem atribuição. Cobertura correta = excluí-los da conta.
- **4 são de origem Meta** (`meta_ads` / `Facebook Leads Ads`), mas são leads antigos (fev–jun/2026), anteriores à captura do `meta_lead_id`. Esses são o furo legítimo — e não têm remédio via trigger: falta o identificador na origem.

**Cobertura recalculada** sobre a base elegível (visita desde 05/08 19:24, lead com `meta_lead_id`): **100%** — 0 furo. O “16%” medido comparava contra o universo total de visitas, incluindo leads que a guarda bloqueia de propósito.

Higiene encontrada de brinde: 73 eventos `VisitaMarcada` na fila para 65 leads, com **2 duplicatas exatas** (mesmo lead + mesmo `visita_id`) — vindas de re-`UPDATE` de status voltando para 'marcada'. Impacto pequeno, mas é sobrecontagem real.

## O que proponho fazer (aditivo, sem tocar no que funciona)

Nada de trigger novo. Duas correções cirúrgicas:

1. **Dedup dentro da `_trg_visita_capi`** — antes de enfileirar `VisitaMarcada`, checar se já existe evento com o mesmo `visita_id` em `meta_capi_queue`; se existir, não enfileira. Mesmo tratamento para `VisitaRealizada`. O disparo por INSERT e por mudança de status continua igual; só deixa de repetir. `event_id` e formato de payload permanecem intactos.
2. **Medição honesta da cobertura** — a fórmula do painel passa a considerar só visitas cujo lead tem `meta_lead_id` (base elegível), e mostrar em separado a contagem de visitas bloqueadas pela guarda, com quebra por origem. Assim o furo de ingestão de `meta_lead_id` fica visível em vez de virar “furo de CAPI”.

Fora do escopo desta correção, mas é a raiz do que sobrou: 4 visitas de leads Meta antigos sem `meta_lead_id`. Se quiser, avalio depois um backfill do `meta_lead_id` via Graph API para leads de origem Meta.

## Detalhes técnicos

- Migração (DDL, 1 migração): `CREATE OR REPLACE FUNCTION public._trg_visita_capi()` acrescentando, antes do `PERFORM`, o guard:
  `IF EXISTS (SELECT 1 FROM public.meta_capi_queue q WHERE q.event_name = v_event AND q.payload->'custom_data'->>'visita_id' = NEW.id::text) THEN RETURN NEW; END IF;`
  Bloco `EXCEPTION WHEN OTHERS` existente preservado (rastreamento nunca derruba a escrita da visita).
- Índice aditivo para o lookup ficar barato: `CREATE INDEX IF NOT EXISTS idx_capi_queue_visita ON public.meta_capi_queue ((payload->'custom_data'->>'visita_id')) WHERE event_name IN ('VisitaMarcada','VisitaRealizada');`
- Nenhum `event_name` novo, nenhuma alteração em `enqueue_meta_capi_event`, nada em roleta/distribuição.
- Frontend: ajuste do cálculo de cobertura em `src/hooks/useCapiSaude.ts` + card correspondente.

## Validação após o build

1. Inserir uma visita de teste com lead que tenha `meta_lead_id` → 1 evento na fila; forçar re-update de status para 'marcada' → segue com 1 evento.
2. Reconferir a query de cobertura: base elegível em 100%, bloqueados listados por origem.
3. Nenhum evento novo aparecendo com `event_time` fora da janela de 7 dias.
