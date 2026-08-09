# Reengajamento Casa Tua Canoas: lead continua marcado como Porto Alegre

## O que os dados mostram (consultado agora)

O template `casatuacanoas_novidade` teve 10 respostas: 7 NÃO e 3 SIM. Os 3 que responderam SIM foram reativados e estão na Fila do CEO (`pendente_distribuicao`), porém todos com o produto errado:

```text
Sonia W. Miralha   -> Casa Tua Porto Alegre  (deveria ser Casa Tua Canoas)
Simone Teixeira    -> Casa Tua Porto Alegre  (deveria ser Casa Tua Canoas)
Paulo Mello        -> Casa Tua Porto Alegre  (deveria ser Casa Tua Canoas)
```

Causa confirmada: nas duas rotinas de reativação (`reativar_lead_para_fila_ceo` e `reativar_base_lead_para_fila_ceo`), o teste do template começa por `%casatua%` e já resolve para "Casa Tua Porto Alegre". Como `casatuacanoas_novidade` contém "casatua", ele nunca chega a uma regra de Canoas — que hoje não existe no banco. O empreendimento canônico "Casa Tua Canoas" existe e está ativo.

Segundo ponto: quando o lead já está **ativo** no pipeline, a rotina só marca `respondeu_sim` e registra atividade — não atualiza o empreendimento. Nesses casos o corretor também não enxerga o novo interesse.

## O que será feito

1. **Regra de Canoas antes da genérica**
   Nas duas rotinas de reativação, testar `casatuacanoas` / `casa tua canoas` / `casa_tua_canoas` **antes** do `casatua` genérico, resolvendo para o canônico ativo "Casa Tua Canoas". Mesmo padrão já usado no frontend (`src/lib/reengajamentoEmpreendimento.ts`).

2. **Novo interesse atualiza o lead mesmo quando ele já está ativo**
   No caminho "já ativo no pipeline", quando o template resolve um empreendimento diferente do atual: atualizar `empreendimento` (canônico recalculado pelos triggers), acrescentar ao histórico a linha `[NOVO INTERESSE …] Casa Tua Canoas — antes: Casa Tua Porto Alegre`, e citar o produto novo na atividade + notificação ao corretor. Etapa, corretor e aceite permanecem intocados.

3. **Backfill dos 3 leads já afetados**
   Sonia, Simone e Paulo passam para Casa Tua Canoas (texto + canônico), com uma linha de histórico registrando o de/para. Sem mexer em etapa nem em aceite — continuam na Fila do CEO, agora distribuíveis para quem está alocado em Canoas.

4. **Validar ao vivo**
   Abrir a Fila do CEO e conferir os 3 leads com "Casa Tua Canoas" e com corretor alocado disponível; conferir o histórico do lead mostrando o novo interesse.

## Detalhes técnicos

- Migration única (DDL): `CREATE OR REPLACE FUNCTION public.reativar_lead_para_fila_ceo(...)` — adicionar `v_is_casatua_canoas` avaliado antes de `v_is_casatua`, com `v_empreend := 'Casa Tua Canoas'` e `v_foco_label` correspondente; e `CREATE OR REPLACE FUNCTION public.reativar_base_lead_para_fila_ceo(...)` — mesmo branch antes do `ILIKE '%casatua%'`. No ramo `already_active` da rotina da Base Única, aplicar o update de empreendimento/observação quando o produto do template diferir do atual.
- Backfill via DML nos 3 `pipeline_leads` (`22556564…`, `4c1ec96c…`, `0b351212…`) apontando `empreendimento_canonico_id = 5f28344e-41e2-4f0c-901d-81455145f6ee`.
- Nada muda em `distribuir_lead_atomico`, higiene, supressões ou no motor de disparo.
