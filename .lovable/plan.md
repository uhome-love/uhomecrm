#  Auditoria do fluxo de criação de tarefas — presets em toda a base

## Mapa de entradas de criação (`INSERT pipeline_tarefas`)


| #   | Onde                                              | Contexto                                                                                          | Presets?                                   | Filtro etapa?            |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| 1   | `MinhasTarefas.tsx` (popup "Nova Tarefa")         | Central de Tarefas — botão ➕                                                                      | ✅                                          | ✅ Q/A/N (feito hoje)     |
| 2   | `NextActionModal.tsx`                             | Drawer do lead: "Nova tarefa" na aba Tarefas, "Criar tarefa" no Card Próxima Ação, botão "Anotar" | ✅                                          | ✅ por `currentStageTipo` |
| 3   | `CompletionForm.tsx` (via `TaskCompletionDialog`) | Bloco "Agendar próxima tarefa" ao concluir qualquer tarefa                                        | ✅                                          | ✅                        |
| 4   | `FocusModeModal.tsx`                              | Modo Foco — usa `TaskCompletionDialog`, herda presets                                             | ✅                                          | ✅                        |
| 5   | `TarefasHojeLateral.tsx`                          | Widget "Tarefas de hoje" no dashboard — usa `TaskCompletionDialog`, herda                         | ✅                                          | ✅                        |
| 6   | `WhatsAppFocusFlow.tsx`                           | Fluxo WhatsApp (drawer): passo "agendar próxima tarefa"                                           | ❌ **livre, sem presets**                   | ❌                        |
| 7   | `CallFocusOverlay.tsx`                            | Fluxo Ligação (drawer): "próximo passo → agendar tarefa"                                          | ❌ **livre, sem presets**                   | ❌                        |
| 8   | `QuickActionMenu.tsx`                             | "Liguei — não atendeu" cria callback fixo +2h                                                     | Automático (fixo) — sem escolha do usuário | &nbsp;                   |
| 9   | `CardQuickTaskPopover.tsx`                        | **Não é importado em lugar nenhum — código morto**                                                | ❌                                          | ❌                        |


## Diagnóstico

- **Coberto (5 pontos):** Central de Tarefas, Drawer do lead, Conclusão de tarefa, Modo Foco, Widget Tarefas de Hoje.
- **Gap real (2 pontos):** WhatsApp Focus e Call Focus — quando o corretor registra o contato e agenda a próxima tarefa dentro desses fluxos, ele **não recebe os chips de preset da etapa do lead**. Isso quebra a padronização: a mesma "Enviar imóveis" pode virar `follow_up` no CallFocus e `envio_material` na Central, dependendo do caminho que o corretor usar.
- **Ruído:** `CardQuickTaskPopover.tsx` existe mas não é usado — mantém código legado desalinhado.
- **Não é gap:** `QuickActionMenu` é fluxo automático (callback fixo +2h para "não atendeu"); não deve receber presets.

## Ações

### 1. Deletar código morto

- Remover `src/components/pipeline/CardQuickTaskPopover.tsx` (nenhum import na base).

### 2. Presets no WhatsAppFocusFlow

Passar `stageTipo` do lead como prop (ou buscar via query) e renderizar o mesmo bloco de chips do `NextActionModal` no passo de agendamento. Ao clicar num chip, popular `taskType`, `taskDate`, `taskTime`, `obs`. Se `presets.length === 0`, manter o modo livre atual (etapa sem preset). Sincronizar `flag_status` no update do lead se o preset tiver `syncFlagKey`.

### 3. Presets no CallFocusOverlay

Mesma mudança do #2 no bloco "agendar tarefa" da fase 3 (`Próximo passo`).

### 4. Validação ao vivo (roteiro fixo)

Para cada ponto, testar num lead **em Qualificação** (chips visíveis), **em Aquecimento** (chips diferentes), **em Sem Contato** (modo livre / bloqueado quando fizer sentido):

1. **Central de Tarefas** (`/minhas-tarefas`) → ➕ Nova Tarefa → buscar lead → chips renderizam por etapa; leads em Descarte/Visita/Contrato não aparecem.
2. **Drawer do lead → aba Tarefas** → "Nova tarefa" → NextActionModal com chips.
3. **Drawer → Card Próxima Ação (vazio)** → "Criar tarefa" → NextActionModal com chips.
4. **Concluir tarefa** (qualquer origem) → bloco "Agendar próxima tarefa" com chips.
5. **Modo Foco** → concluir tarefa do lead → chips no fluxo de agendar próxima.
6. **Widget Dashboard "Tarefas de hoje"** → concluir tarefa direto do widget → chips.
7. **Drawer → botão WhatsApp** → após enviar, agendar próxima → chips (após implementação).
8. **Drawer → botão Ligar** → concluir ligação, próximo passo → chips (após implementação).

Cada passo confirma:

- Chips corretos por etapa (Qualificação: enviar imóveis, busca, alinhar perfil, retomar, outro; Aquecimento: prazos 30/60/90; Em Negociação: proposta enviada, aprovação, correspondente, documentação).
- Ao clicar o chip → tipo/data/hora/observação preenchidos.
- `flag_status` do lead atualiza quando o preset tem `syncFlagKey`.

### 5. Fora de escopo

- Não mexer em `QuickActionMenu` (callback +2h é fixo por design).
- Não mexer em criação implícita por triggers/cron (visita, cadência sem contato, aquecimento auto).
- Sem migration.

## Arquivos afetados

- **Deletar:** `src/components/pipeline/CardQuickTaskPopover.tsx`
- **Editar:** `src/components/pipeline/WhatsAppFocusFlow.tsx`, `src/components/pipeline/CallFocusOverlay.tsx`