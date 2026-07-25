# Habilitar tarefas manuais na etapa Visita (auditoria ponta a ponta)

## Auditoria — todos os pontos de criação de tarefa hoje

| # | Ponto de entrada | Arquivo / linha | Estado atual na etapa Visita |
|---|---|---|---|
| 1 | Botão "Nova tarefa" no drawer do lead | `drawer/DrawerTasksTab.tsx:134,202` | ✅ Já libera manual + banner informativo (ok) |
| 2 | Popup "Próxima Ação" (card no topo do drawer + pós-conclusão) | `NextActionModal.tsx:231-238` | 🔒 Bloqueia com alerta âmbar "Não crie tarefas manuais aqui" |
| 3 | Página `/tarefas` — botão "Nova tarefa" (busca de lead) | `MinhasTarefas.tsx:393-403` | 🔒 Visita não entra em `elegibleStageIds` (só qualif/aquec/negociacao), então o lead nem aparece no autocomplete |
| 4 | Página `/tarefas` — submit final | `MinhasTarefas.tsx:730` | 🔒 `toast.error("Etapa Visita: tarefas são automáticas...")` |
| 5 | Popup de conclusão de tarefa (`CompletionForm`) → "Agendar próxima tarefa" | `CompletionForm.tsx:543-552` | 🔒 Substitui form por card informativo "próxima tarefa vem da Agenda" |
| 6 | `TaskCompletionDialog` na Visita | `TaskCompletionDialog.tsx:249-270` | ✅ Correto: força `VisitaCompletionFlow` **quando existe tarefa `visita_auto` pendente**. Não deve ser tocado — é o fluxo fixo pós-visita e não impede criação manual por outros caminhos |
| 7 | Preset canônico de Visita | `taskPresets.ts:177-215` (`VISITA_PRESETS`) | ✅ Já existe: Ligar / WhatsApp / Enviar material / Follow-up + Outro |
| 8 | `visita_auto_tarefas()` trigger (agenda D-1, no-show +48h, feedback +24h) | Backend | ✅ Cria tarefas com `origem='visita_auto'` — reconciliação só toca essas; manuais não sofrem interferência |

## Mudanças propostas (só destravar #2, #3, #4, #5)

### 1. `src/components/pipeline/NextActionModal.tsx`
- Remover o bloqueio `currentStageTipo === "visita"` (linhas ~231-238).
- Renderizar o mesmo bloco de presets/free-mode das outras etapas. `getPresetsForStage("visita")` já devolve `VISITA_PRESETS`.
- Acima dos presets, quando Visita, exibir aviso **informativo, não bloqueante** (mesmo tom do drawer):
  > 🏠 Etapa Visita: confirmação, remarcação e feedback são criadas automaticamente pela Agenda conforme o status da visita. Use aqui para contatos e follow-ups manuais.

### 2. `src/pages/MinhasTarefas.tsx`
- Linha 399: adicionar `"visita"` ao `.in("tipo", [...])` de `elegibleStageIds` para o autocomplete listar leads em Visita.
- Linha 730: remover o early-return com toast. Deixar seguir o fluxo normal de insert.
- No card "Sugestão de próxima tarefa" (linha ~1111), quando `stageTipoSelecionado === "visita"`, mostrar o mesmo aviso informativo acima dos presets.

### 3. `src/components/pipeline/task-completion/CompletionForm.tsx`
- Linha 543: remover o ramo `stageTipo === "visita"` que troca o form por card informativo.
- Deixar cair no ramo `else` padrão — `getPresetsForStage("visita")` traz os pills e habilita "Agendar" manualmente.
- Acima do bloco "Como prosseguir?", exibir aviso informativo (mesma redação do drawer) quando `stageTipo === "visita"`.

### 4. Nada mais precisa mudar
- `DrawerTasksTab.tsx`: já ok.
- `TaskCompletionDialog.tsx`: não mexer — `VisitaCompletionFlow` só é acionado quando existe uma `visita_auto` pendente sendo concluída; tarefas manuais não caem nesse ramo, pois são concluídas pelo fluxo padrão.
- Triggers/backend: nada muda. Manuais têm origem diferente de `visita_auto` e não são canceladas por reconciliação.

## Validação ponta a ponta (com lead de teste em etapa Visita)

1. **Drawer → Nova tarefa** → salvar preset "Ligar para confirmar" — confirmar criação e cancelar.
2. **Drawer → concluir uma tarefa manual** → popup `CompletionForm` → escolher "Agendar" → pills de Visita aparecem → salvar → confirmar.
3. **Drawer → concluir uma tarefa `visita_auto`** → deve continuar abrindo `VisitaCompletionFlow` (não regredir esse caminho).
4. **Card "Próxima Ação" (topo do drawer)** → registrar ação → escolher "Agendar nova tarefa" → confirmar que os pills de Visita aparecem sem alerta bloqueante.
5. **`/tarefas` → "Nova tarefa"** → digitar nome do lead em Visita → confirmar que aparece no autocomplete → escolher preset → salvar.
6. **Mover lead para "visita marcada / realizada / no-show"** → confirmar que `visita_auto_tarefas()` continua criando as tarefas automáticas, sem duplicar nem cancelar as manuais criadas nos passos anteriores.
7. Todos os testes com lead de teste; cancelar/apagar as tarefas criadas ao final.

## Fora de escopo
- Triggers de agenda de visita.
- `VisitaCompletionFlow` e seus subtipos.
- Qualquer outra etapa (Qualif, Aquec, Negociação, Sem Contato).
