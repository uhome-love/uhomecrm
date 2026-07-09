# Corrigir venda Victor Ourique (Alto Lindóia 411 Torre D)

## Situação atual
Existem **2 registros de venda** (`negocios`) para o mesmo cliente, ambos `fase='vendido'` e atribuídos ao corretor **Junior Padilha** na equipe do gerente **Gabriel Vieira**:

1. `1f56b82f` — "Victor Ouriques", sem unidade, VGV 368.000, **data assinatura 09/07/2026** → é este que faz a venda aparecer indevidamente em **julho**.
2. `b5e6447b` — "Victor Ourique", unidade "411 D", VGV 368.466, data assinatura 10/02/2026.

Há também 1 card no pipeline (`pipeline_leads` id `d9913603`) "Victor Ouriques" na etapa **Ganho**, corretor Junior, **sem gerente** e **sem valor**.

Dado correto informado: venda realizada em **15/02/2026**, Alto Lindóia — **411 Torre D**, **R$ 368.466,00**, corretor **Junior** (hoje gerente), equipe **Gabriel Vieira**.

## Correções

### 1. Remover o registro duplicado de julho
Excluir o `negocios` `1f56b82f` (o de 09/07 sem unidade e com VGV 368.000). Isso remove a venda incorreta do mês de julho.

### 2. Consolidar o registro correto em fevereiro
No `negocios` `b5e6447b`, ajustar:
- `data_assinatura` → **2026-02-15** (hoje está 10/02)
- `unidade` → **"411 - Torre D"**
- `vgv_estimado` → **368466** (mantém)
- `fase` = `vendido` (mantém)
- `corretor_id` = Junior Padilha (mantém)
- `auth_user_id` = Junior (mantém)
- `equipe_gerente_auth_id` = Gabriel Vieira (mantém)

Resultado: a venda passa a constar **apenas em fevereiro/2026**, com corretor Junior e equipe Gabriel Vieira preservados.

### 3. Alinhar o card do pipeline (etapa Ganho)
No `pipeline_leads` `d9913603`:
- manter na etapa **Ganho** e corretor **Junior**
- preencher `gerente_id` = Gabriel Vieira
- preencher `valor_estimado` = 368466
- (opcional) padronizar `nome` para "Victor Ourique"

## Validação final
- `SELECT` em `negocios` retorna **1 único** registro Victor Ourique, fase vendido, 15/02/2026, 411 Torre D, 368.466, Junior / Gabriel Vieira.
- Venda **não aparece mais em julho**; aparece em **fevereiro** na página Vendas Realizadas.
- Card no pipeline segue em **Ganho** com corretor e gerente corretos.
- Contagem/VGV de fevereiro do corretor Junior e da equipe Gabriel Vieira permanece consistente com a planilha.
