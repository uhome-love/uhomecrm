## Objetivo

Deixar a etapa **Sem Contato** correta, completa e bonita: tarefas concluídas visíveis, histórico legível por tentativa, **observação obrigatória ao concluir em TODOS os pontos**, contagem de tentativas correta (sem pular passos) e status sempre automático.

---

## Diagnóstico (causa raiz)

1. **Tarefas concluídas somem** — a aba Tarefas do modal usa `DrawerTasksTab`, que só renderiza pendentes (agrupadas por prazo). Concluídas nunca aparecem.
2. **Camila "pulou" para T3 com 1 tarefa concluída** — **contagem dupla**: a cadência avança em DOIS gatilhos — ao **criar** a tarefa (`trg_cadencia_sc_avancar_tarefa`) E ao **concluir** (insere atividade → `trg_cadencia_sc_avancar_acao`). Criar + concluir = +2.
3. **"Status da Etapa / Tentativas: 0/7"** — `LeadFlagControls` já retorna `null` para `sem_contato`; o print é build em cache. Só valido.
4. **Observação opcional na conclusão** — hoje o campo é opcional no `TaskCompletionDialog`, e há **2 pontos que concluem sem nem abrir o diálogo**.

### Auditoria — pontos de conclusão de tarefa
- Via `TaskCompletionDialog` (serão cobertos pela obrigatoriedade): `DrawerTasksTab`, `LeadTarefasTab`, `MinhasTarefas`, `FocusModeModal`/`FocusFooter`.
- **Bypass (concluem direto, sem observação)**: `MinhaAgendaWidget` (✓ rápido) e `LeadPanel` (WhatsApp). Precisam abrir o diálogo.
- Fora de escopo: `TarefasPage` (board operacional, tabela `tarefas`) e os `concluida` de `ConversationThread` (são `pipeline_atividades`).

---

## Mudanças

### 1. Backend — cadência avança só ao concluir (1 migração)
- Remover trigger `trg_cadencia_sc_avancar_tarefa` e função `fn_cadencia_sc_avancar_tarefa` (avanço na criação).
- Manter `fn_cadencia_sc_avancar_acao` (avança quando atividade de contato é registrada = ao concluir, e nas ações Ligar/WhatsApp).
- Resultado: criar tarefa = planejar; **concluir** = conta como tentativa. T2 → T3 só ao concluir a tarefa da T2.

### 2. Correção de dados (1 operação)
- Recalcular `tentativa_atual` das cadências `ativa`/`concluida` em Sem Contato para o nº real de ações de contato concluídas (cap 7), corrigindo Camila e leads super-contados. Reabrir os marcados como concluídos por engano e não arquivados.

### 3. Observação obrigatória em TODA conclusão
- **`TaskCompletionDialog`**: tornar observação/descrição **obrigatória** (botão Confirmar desabilitado + mensagem enquanto vazio). Cobre DrawerTasksTab, LeadTarefasTab, MinhasTarefas e FocusMode.
- **`MinhaAgendaWidget`**: substituir o ✓ rápido por abertura do `TaskCompletionDialog` (ou mini-prompt obrigatório de observação) antes de concluir.
- **`LeadPanel`**: mesma correção — concluir só via `TaskCompletionDialog`/observação obrigatória.

### 4. Tarefas concluídas visíveis (`DrawerTasksTab`)
- Seção **recolhível "✓ Concluídas (N)"** ao final; cada item mostra tipo + título, **observação** e data/hora de conclusão. Fechada por padrão.

### 5. Histórico legível (`LeadHistoricoTab`)
- Eventos de conclusão exibem **"Tarefa {tipo}: Concluída"** + observação.
- Em Sem Contato, rotular como **"Tentativa N: {ação} — concluída"** e indicar a **tentativa atual pendente**.

### 6. Card de cadência mais claro (`CadenciaSemContatoCard`)
- Reforçar: **"Você está na tentativa N/7 — registre ou conclua a tarefa pendente para avançar."**
- Mostrar progresso mesmo quando `concluida` mas lead não arquivado (evita "esgotada" enganoso).

### 7. Status automático (validação)
- Confirmar que `LeadFlagControls` não renderiza nada em `sem_contato` (já é o caso). Card de cadência é a única referência.

---

## Detalhes técnicos
- **Arquivos**: `drawer/DrawerTasksTab.tsx`, `TaskCompletionDialog.tsx` (+ `task-completion/*`), `LeadHistoricoTab.tsx`, `CadenciaSemContatoCard.tsx`, `corretor/MinhaAgendaWidget.tsx`, `whatsapp/LeadPanel.tsx`.
- **DB**: migração `DROP TRIGGER`/`DROP FUNCTION`; operação de dados (UPDATE) recalculando `tentativa_atual`.
- Sem rota/tabela nova.

## Validação
- Concluir tarefa em Sem Contato → tentativa +1; criar tarefa não avança.
- Nenhum ponto conclui tarefa sem observação (inclui agenda e WhatsApp).
- Concluída aparece na seção "Concluídas" com a observação.
- Histórico mostra "Tarefa X: Concluída" + observação e numeração por tentativa.
- Caso Camila: 1 ação concluída + 1 pendente.
