Continuar a implementação dos bugs restantes:

## Pendências

### 1. Oferta Ativa — UI de data/hora da visita
- `AttemptModal.tsx`: adicionar JSX com DatePicker (shadcn) + Input time quando "Visita marcada" selecionado. Default: amanhã 10:00.
- `CustomListAttemptModal.tsx`: mesma UI, propagar `dataVisita`/`horaVisita` no submit.
- `DialingModeWithScript.tsx`: passar valores adiante para `createVisitaFromOA`.

### 2. Modo Foco — tarefas do lead inline
- `FocusModeModal.tsx`: novo bloco "📋 Tarefas do lead" consultando `pipeline_tarefas` (status=pendente, pipeline_lead_id=current).
- Badge vermelho para `vence_em < hoje BRT`, cinza para futuras.
- Botão "✅ Concluir" abre `TaskCompletionDialog` inline.
- Botão "➕ Nova tarefa" abre mini-form (`CardQuickTaskPopover`).
- Invalidar `[pipeline-tarefas]`, `[pipeline-leads]` após ações.

### 3. Minha Rotina — overdue correto + cards clicáveis
- `MinhaAgendaWidget.tsx`: usar `startOfDayBRT`/`nowBRT` de `@/lib/brtTime` no `classify()`.
- Tarefa com `vence_em = hoje` + `hora_vencimento` no futuro → "próxima", nunca "atrasada".
- `renderTarefa`: tornar clicável → navega `/pipeline?leadId=<pipeline_lead_id>` (abre drawer).

### 4. Notificação "Lead precisa atualização" — excluir Venda Realizada
- Edge function de notificação: filtrar `WHERE stages.tipo != 'convertido'` (Venda Realizada).
- Migração: limpar notificações existentes para leads em estágio convertido.

## Arquivos
- `src/components/oferta-ativa/AttemptModal.tsx`
- `src/components/oferta-ativa/CustomListAttemptModal.tsx`
- `src/components/oferta-ativa/DialingModeWithScript.tsx`
- `src/components/pipeline/FocusModeModal.tsx`
- `src/components/corretor/MinhaAgendaWidget.tsx`
- Edge function de notificações (a localizar)
- Migração de limpeza
