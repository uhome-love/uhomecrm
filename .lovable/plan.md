## Objetivo

No widget **Minha Rotina** (`/corretor`), exibir apenas tarefas:
- **Vencidas** (dias passados, ou hoje com hora já passada), OU
- **A vencer hoje COM hora marcada**

Tarefas de hoje **sem `hora_vencimento`** deixam de aparecer (até virarem atrasadas no dia seguinte). As 11 follow-ups automáticas da Adriana, por exemplo, sumirão da lista até receberem hora ou virarem atrasadas amanhã.

## O que muda

### `src/components/corretor/MinhaAgendaWidget.tsx`

Na função `classify` (linha 142):

- **`proximas`** (linha 151-155): hoje em dia inclui `vence_em == today` sem hora. Alterar para exigir `hora_vencimento` não-nulo:
  - Antes: `if (!t.hora_vencimento) return true;`
  - Depois: `if (!t.hora_vencimento) return false;` (esconde follow-ups de hoje sem hora)
- **`atrasadas`** (linha 143-149): mantida igual — `vence_em < today` continua atrasada, e hoje com hora < agora continua atrasada. Follow-ups de hoje sem hora **não** entram em atrasadas (só virarão atrasadas amanhã, quando `vence_em < today`).
- **`amanha`**: sem alteração.

Os contadores do badge ("Hoje · N", "Atrasadas · N") e as Tabs (Leads/Negócios) recalculam automaticamente a partir de `classify`.

## O que NÃO muda

- Lógica de SLA global (`mem://rules/business/sla-and-overdue-logic` — default 23:59) permanece para outras telas; só este widget muda o critério de exibição.
- Central de Tarefas (`/corretor/tarefas`) e Pipeline continuam mostrando tarefas sem hora — eles têm filtros próprios e o usuário pediu o ajuste especificamente para Minha Rotina.
- Nenhum dado é alterado no banco; mudança puramente visual/cliente.

## Impacto esperado para a Adriana

- Hoje (15/05): widget mostra 0 tarefas (as 11 são follow-ups sem hora).
- Amanhã (16/05): essas 11 viram "Atrasadas" automaticamente e voltam a aparecer.
- Tarefas com hora (ex.: Almeida Diesel 14:00 em 16/05) aparecem normalmente no bloco "Amanhã" e migram para "Próximas" no dia.
