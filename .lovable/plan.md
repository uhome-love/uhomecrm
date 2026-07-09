## Problema

No Dashboard CEO, o painel "Roleta de Leads" ainda conta os 13 leads que foram cadastrados hoje só para registrar Vendas Realizadas. Eles entram como:
- **"Sem empreendimento" = 13** em *Leads por Empreendimento*
- **"Desconhecido" = 13** em *Leads por Origem*

Confirmei no banco: são exatamente 13 leads na etapa **Ganho** (`tipo = venda`), todos com `empreendimento` e `origem` vazios. Não são leads de marketing — são vendas fechadas importadas manualmente, então poluem a contagem da Roleta.

A correção anterior foi feita apenas em `LeadsGeradosTab.tsx` (a aba de detalhe). O **hook do Dashboard CEO** (`useCeoDashboard.ts`) tem sua própria consulta e nunca recebeu esse filtro.

## Correção

No `src/hooks/useCeoDashboard.ts`, na consulta `leadsCriados` (o `fetchAllRows` que lê `pipeline_leads` por `created_at`), adicionar a exclusão da etapa Ganho:

```
.neq("stage_id", "2d7739eb-1787-4ad6-887a-7a4a32dcfc05")
```

Isso remove os leads de venda fechada de toda a seção Roleta do CEO (Leads Gerados, Leads por Empreendimento, Leads por Origem, Leads por Corretor), alinhando com o que já foi feito na aba de detalhe. Nenhum dado de venda é alterado — apenas a contagem visual da Roleta.

## Observações

- Não afeta a seção de Vendas nem o PDN — estes usam a tabela `negocios`, não `pipeline_leads`.
- Puramente frontend/consulta; sem migração de banco.
