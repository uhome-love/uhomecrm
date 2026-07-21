# Plano — Card "Próxima Ação" (v2) + Presets na Central de Tarefas

Duas frentes independentes, entregues em sequência. Só backend/UI de frontend — sem migration.

---

## Frente 1 · Card "Próxima Ação" no topo do drawer do lead

### Situação atual
- `DrawerProximaAcao` já existe (`src/components/pipeline/drawer/DrawerProximaAcao.tsx`) e é renderizado no drawer, mas: (a) fica DEPOIS dos cards de cadência/estagnação, (b) não tem botões de ação, (c) estado vazio só exibe texto.

### Mudanças
1. **Reordenar** em `PipelineLeadDetail.tsx`: mover `<DrawerProximaAcao ... />` para ser o PRIMEIRO card do `bodyNode` (acima de `CadenciaSemContatoCard` e `EstagnacaoStatusCard`). A sugestão de etapa do gestor continua acima de tudo (é um aviso, não um card).
2. **Adicionar 2 botões** dentro de `DrawerProximaAcao` quando há tarefa:
   - **✓ Concluir agora** (primary) → chama o mesmo handler já existente no drawer para abrir o `TaskCompletionDialog` da tarefa mais próxima. Passar via prop `onComplete(taskId)`.
   - **Ver todas (N)** (ghost, só aparece se `pendingCount > 1`) → chama prop `onSeeAll()` que troca para a aba "Tarefas" do drawer e faz scroll.
3. **Estado vazio**: substituir texto italico atual por card cinza claro + botão "➕ Criar tarefa" que chama prop `onCreateTask()` (abre o `NextActionModal` já existente).
4. **Badge âmbar** "⚠ N tarefas pendentes" já existe — mantém.
5. Sem "Adiar" (já removido do sistema, nada a fazer).

### Contrato do componente (novo)
```ts
interface Props {
  nextTask: NextTaskLike | null;
  proximaAcaoTexto?: string | null;
  pendingCount?: number;
  onComplete?: (taskId: string) => void;   // NOVO
  onSeeAll?: () => void;                   // NOVO
  onCreateTask?: () => void;               // NOVO
}
```

### Wiring em `PipelineLeadDetail.tsx`
- `onComplete`: reusar o handler já existente que abre `TaskCompletionDialog` para uma tarefa (mesmo caminho que a lista de tarefas pendentes usa).
- `onSeeAll`: `setActiveTab("tarefas")` (aba já existente) — se não houver tab, fazer scroll até `#pending-tasks-anchor`.
- `onCreateTask`: `setNextActionOpen(true)` (mesmo botão "Nova tarefa" já existente no header).

### Arquivos alterados
- `src/components/pipeline/drawer/DrawerProximaAcao.tsx` — adicionar botões, estado vazio com CTA.
- `src/components/pipeline/PipelineLeadDetail.tsx` — reordenar card + passar as 3 props.

---

## Frente 2 · Presets manuais na Central de Tarefas (`MinhasTarefas.tsx`)

### Situação atual
- Página ativa é `src/pages/MinhasTarefas.tsx` (roteamento em `pageRegistry.ts`).
- Dialog "➕ Nova Tarefa" (linhas 1149-1218) tem: busca de lead, tipo, data, hora, observação. Sem presets.
- `src/lib/taskPresets.ts` já expõe `getPresetsForStage()` e `applyPresetToTarefa()` — mesma lógica do drawer.

### Mudanças
1. Ao selecionar um lead na busca, resolver o **stage_id → tipo da etapa** (query rápida em `pipeline_stages` OU incluir `stage_tipo` no `searchLeads` que já busca leads).
2. Se `getPresetsForStage(stageTipo).length > 0`, renderizar acima do bloco "Tipo" um grid de chips (mesmo visual do drawer/CompletionForm).
3. Clicar em chip → `applyPresetToTarefa(preset)` → preenche `novoTipo`, `novoData`, `novoHora`, `novoObs`. Campos continuam editáveis.
4. Guardar o preset selecionado em state (`selectedPreset`). Ao salvar (`handleCriarTarefa`), se houver `preset.syncFlagKey`, aplicar em `pipeline_leads.flag_status[key] = value` — mesmo padrão já usado em `NextActionModal.tsx` (copiar a lógica de sync).
5. Chip "Outro (livre)" limpa o preset e volta ao modo manual.
6. Etapa "visita" mantém bloqueio já existente na criação manual (não altero — `getPresetsForStage("visita")` retorna vazio e nada aparece; a validação anti-visita atual permanece).

### Arquivos alterados
- `src/pages/MinhasTarefas.tsx` — adicionar state `selectedLeadStageTipo` + `selectedPreset`, buscar stage_tipo junto do lead, renderizar chips no dialog, aplicar `flag_status` no save.

Sem novos arquivos, sem migration, sem alterar `taskPresets.ts`.

---

## Ordem de execução

1. **Frente 1** (Próxima Ação) — mais isolado e visível. Validar ao vivo abrindo drawer de qualquer lead com tarefa pendente e sem tarefa.
2. **Frente 2** (Presets em MinhasTarefas) — após validação da Frente 1.

## Validação (ao vivo, sem alterar leads reais)

- **Frente 1**: abrir drawer de lead com tarefa atrasada → card no topo, texto vermelho, botão Concluir abre popup, Cancelar sem alterar. Lead sem tarefa → estado vazio com CTA. Lead com 2+ tarefas → badge âmbar aparece.
- **Frente 2**: em /minhas-tarefas → Nova Tarefa → buscar lead em Qualificação → chips aparecem, clicar em "Alinhar perfil" preenche campos, Cancelar sem salvar. Buscar lead em Sem Contato → chips não aparecem.

## Não-escopo (fica para próxima)

- Presets no `TarefasPage.tsx` legado (não roteado).
- Presets na aba "Nova tarefa de Negócio" (fluxo separado).
- Alteração visual dos chips (herda visual atual do drawer).
