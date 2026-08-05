# Venda da Renata (30/07, R$ 298.651 · Cássio Ferreira) não entra em "Vendas Realizadas"

## O que está acontecendo (confirmado no banco)

- O lead **Renata Gouvêa Campesato** está sim na coluna **Ganho** do pipeline (etapa "Ganho").
- Mas o **negócio** dela ainda está em `fase = contrato`, **sem data de assinatura** e **sem VGV final** (só o estimado de R$ 298.651).
- "Vendas Realizadas"/VGV assinado só conta negócio com **fase Ganho + status ativo + data de assinatura**. Por isso ela não aparece.

## Por que o Gabriel não conseguiu salvar

O console mostra o erro real na hora de salvar o negócio:

```text
Erro ao salvar negócio: column tm.corretor_id does not exist
```

Existe um gatilho no banco (`stamp_negocio_equipe_gerente`) que roda **exatamente quando o negócio vira Ganho ou recebe data de assinatura**. Ele consulta a tabela de membros de equipe por uma coluna `corretor_id` que **não existe** (a coluna correta é `user_id`). Resultado: qualquer tentativa de marcar a venda como assinada falha e nada é gravado — a etapa do lead até mudou para Ganho, mas o negócio ficou parado em Contrato.

## Correção proposta

1. **Corrigir o gatilho** (migration única): trocar `tm.corretor_id` por `tm.user_id` na função `stamp_negocio_equipe_gerente`. Nada mais na função muda.
2. **Regularizar a venda da Renata** (correção de dado pontual): fase `ganho`, status `ativo`, `data_assinatura = 2026-07-30`, `vgv_final = 298651`, mantendo corretor Cássio Ferreira e empreendimento Open Bosque.
3. **Validar ao vivo no preview**: abrir o lead, confirmar que o card aparece em "Vendas Realizadas" / VGV assinado de julho, e fazer um teste de salvar Ganho em um negócio de teste para provar que o erro sumiu.

## Detalhe técnico

- Função: `public.stamp_negocio_equipe_gerente()` (trigger BEFORE em `negocios`), `SELECT tm.gerente_id FROM team_members tm WHERE tm.corretor_id = NEW.auth_user_id` → deve ser `tm.user_id`.
- Colunas reais de `public.team_members`: `id, gerente_id, nome, equipe, status, created_at, updated_at, user_id`.
- Negócio afetado: `9b150df1-7f96-4d3c-8e04-719591a85e2c` (lead `e18fb840-…`).
- Sem alteração de frontend. Uma migration de DDL (função) + um ajuste de dado.
