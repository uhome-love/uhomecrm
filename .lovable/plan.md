# Melhoria 1 — Unificar a criação da próxima tarefa

Objetivo: o card "PRÓXIMA AÇÃO" (`DrawerProximaAcao`) e o chip de status pararem de ficar defasados depois de concluir uma tarefa pelo diálogo. Hoje há dois caminhos que criam a próxima tarefa e gravam campos diferentes no lead.

## 1. O que cada caminho grava hoje (código real)

### A) `NextActionModal.tsx` (opção "Agendar nova tarefa") — completo
Insere em `pipeline_tarefas`:
```ts
pipeline_lead_id, titulo: tituloLabel, descricao, tipo, prioridade: "media",
status: "pendente", responsavel_id: user.id, vence_em, hora_vencimento, created_by
```
E logo depois atualiza o lead:
```ts
await supabase.from("pipeline_leads").update({
  proxima_acao: tituloLabel,
  data_proxima_acao: tarefaData,
  ultima_acao_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...(flagPatch ? { flag_status: flagPatch } : {}),
}).eq("id", leadId);
```
`flagPatch` = merge de `flag_status` atual com `activePreset.syncFlagKey/Value` (presets de `taskPresets.ts`, ex. `status_atendimento=alinhamento_perfil`, `prazo=30`, `status_negociacao=proposta_enviada`).

### B) `taskCompletion.ts::runTaskCompletion()` com `outcome='agendar'` — incompleto
```ts
if (outcome === "agendar" && nova_tarefa) {
  const titulo = `${TIPO_LABELS[nova_tarefa.tipo]}: ${ctx.leadNome}${dateSuffix}`;
  await ctx.addTarefa({ tipo, titulo, descricao, vence_em, hora_vencimento });
  ...
}
```
`ctx.addTarefa` é `usePipelineLeadData.addTarefa`, que insere em `pipeline_tarefas` e atualiza no lead **apenas**:
```ts
{ ultima_acao_at, updated_at }
```
Antes disso, `runTaskCompletion` já faz um touch de `{ ultima_acao_at, updated_at }` (passo 2).

**Diferença — o que falta em B:** `proxima_acao`, `data_proxima_acao` e o `flag_status` do preset. Por isso o card fica defasado até um reload recalcular pela nextTask.

## 2. Função única `createNextTask()`

Novo arquivo `src/lib/createNextTask.ts`:

```ts
export interface CreateNextTaskInput {
  leadId: string;
  userId: string;
  tipo: string;
  titulo: string;
  descricao?: string | null;
  vence_em: string;            // YYYY-MM-DD BRT
  hora_vencimento?: string | null;
  prioridade?: string;         // default "media"
  /** preset opcional — aplica flag_status[syncFlagKey] = syncFlagValue */
  syncFlag?: { key: string; value: string } | null;
}
export async function createNextTask(input: CreateNextTaskInput):
  Promise<{ ok: boolean; error?: string }>
```

O que grava (uma única vez, sempre igual nos dois caminhos):
1. `INSERT pipeline_tarefas` com os mesmos campos do caminho A (status `pendente`, `responsavel_id`/`created_by` = userId).
2. Se `syncFlag`: lê `pipeline_leads.flag_status`, faz merge.
3. `UPDATE pipeline_leads` com `proxima_acao = titulo`, `data_proxima_acao = vence_em`, `ultima_acao_at`, `updated_at` e, quando houver, `flag_status`.
4. Mantém a validação `isTaskDateTooFar` já existente onde ela hoje ocorre (Modal valida antes de chamar; no helper fica como guarda de segurança devolvendo `ok:false`).

Sem toast, sem invalidate, sem reload dentro do helper — quem chama continua responsável por isso (preserva o comportamento atual de cada tela).

### Onde passam a chamar
- `NextActionModal.handleConfirm` (ramo `selected === "tarefa"`): substitui o insert + update inline por uma chamada a `createNextTask` com `syncFlag` derivado de `activePreset`. Toast, `resetForm`, `invalidateTaskQueries` e `onReload` permanecem exatamente como estão.
- `taskCompletion.runTaskCompletion` (ramo `outcome === 'agendar' && nova_tarefa`): substitui `ctx.addTarefa(...)` por `createNextTask(...)`, mantendo a mesma composição de título (`TIPO_LABELS[tipo]: leadNome · dd/mm`) e a mesma descrição. `ctx.addTarefa` fica opcional na interface (não mais invocada nesse ramo) — os callers (`DrawerTasksTab`) já fazem `onReload()` + `invalidateTaskQueries` depois, então o refresh do card não muda.
- `taskPresets.ts`: sem mudança funcional; só é a fonte do `syncFlag`.

Nada além disso muda: passos 5/6/7 de `runTaskCompletion` (stage, descartar, inativar), atividades, toasts e níveis de retorno ficam idênticos.

## 3. Sem dupla escrita / sem tarefa duplicada

- No caminho A o insert inline é **removido** e trocado pelo helper → 1 insert.
- No caminho B a chamada a `ctx.addTarefa` é **removida** e trocada pelo helper → 1 insert (hoje já é 1; não somamos outro).
- O `UPDATE` de lead do helper é o mesmo que hoje já roda no caminho A; no caminho B ele apenas amplia o touch que já existia (mesma linha, campos a mais) — não gera linha nova nem histórico novo.
- `completeLeadTask.ts` (atalho do card no Kanban) está fora do escopo fechado e não é tocado nesta melhoria.

## 4. Guardrail Sem Contato (linha vermelha)

Confirmado no código: `TaskCompletionDialog` (linhas ~309-334) trata **toda** tarefa em `stage='sem_contato'` como cadência (`const isCadenciaTask = true`), força `outcome='concluir'` e não monta `nova_tarefa`. Como `createNextTask()` só é chamada dentro de `if (outcome === 'agendar' && nova_tarefa)`, o caminho Sem Contato **continua sem criar nem gravar próxima tarefa pela UI** — quem cria segue sendo o gatilho `trg_cadencia_sem_contato`.

Reforço opcional (defensivo, sem mudar comportamento): early-return no ramo 'agendar' quando o stage do lead for `sem_contato`. Não altera nenhum fluxo legítimo, apenas impede regressão futura.

## Fora de escopo
Cadência, trigger, migrations, visual, `TaskCompletionDialog` (nenhuma alteração), `completeLeadTask.ts`, publish.
