## Mudança 4 FINAL — Remover Tabs + Adicionar ScriptsCard

### Verificações prévias (concluídas)

**1. Campo do empreendimento:** `lead.interest` (já populado a partir de `pipeline_leads.empreendimento` em `useFocusLeads.ts:420`). Vou usar `lead.interest` direto, com fallback "nosso empreendimento" no `buildScriptText`.

**2. "Negócio Criado" no Modo Foco:** já está excluído. Query confirmou que existe um único stage `tipo='convertido'` (nome = "Negócio Criado") e `useFocusLeads.ts` já filtra:
```ts
if ((s as any).tipo === "descarte" || (s as any).tipo === "convertido") continue;
```
Nada a fazer no hook.

**3. `handleCopyPhone`:** usado APENAS dentro do bloco Tabs (linhas 878 e 887), ambas dentro da TabsContent "call". O Popover Ligar do top strip (R3.5) tem sua própria implementação inline em `LeadFocusScreen.tsx`. Logo, `handleCopyPhone` pode ser removido com segurança.

### Imports / estados / handlers órfãos a remover de `FocusModeModal.tsx`

**Imports:**
- `Tabs, TabsList, TabsTrigger, TabsContent` (linha 8) — só usados no bloco
- `Textarea` — só usado em followup/call (confirmar não há outro uso)
- `Input` — só no bloco task (confirmar)
- `Send, MessageCircle, Copy` — verificar; `Copy` e `Check` podem permanecer se outros lugares usam

**Constantes:** `QUICK_MESSAGES` (linha 44)

**Estados:** `tab/setTab`, `followUpText/setFollowUpText`, `activityNote/setActivityNote`, `taskTitle/setTaskTitle`, `taskType/setTaskType`, `taskDueDate/setTaskDueDate`, `phoneCopied/setPhoneCopied`, `activityRegistered/setActivityRegistered`, `taskCreated/setTaskCreated`

**Handlers:** `handleRegisterActivity`, `handleCreateTask`, `handleOpenWhatsApp`, `handleCopyPhone`

**Reset (linha 304):** remover `setTab("followup")` e demais resets relacionados.

**Linha 1045-1050:** condicional usando `activityRegistered || taskCreated` para estilo do botão "Avançar próximo lead" — vou trocar por `false` (mantém o estilo "neutro") ou simplificar para sempre usar o estilo do gradient se nextLead existir. Preserva botão visualmente.

### Diff resumido por arquivo

**`src/components/pipeline/FocusModeModal.tsx`**
- Remover bloco Tabs completo (linhas ~765-959, ~195 linhas)
- Remover imports/estados/handlers órfãos listados acima
- Ajustar linha 1045-1050 (condição com `activityRegistered || taskCreated`)
- Resultado: arquivo encolhe ~250 linhas

**`src/components/pipeline/focus/scriptsByStage.ts`** (NOVO)
- Tipos `ScriptId`, `ScriptOption`
- `SCRIPTS_BY_STAGE` mapa stage→scripts (6 stages × 3-4 scripts)
- `DEFAULT_SCRIPTS` fallback
- `SCRIPT_TEMPLATES` (20 templates com `{nome}/{empreendimento}/{corretor}`)
- `getScriptsForStage()`, `buildScriptText()`

**`src/components/pipeline/focus/ScriptsCard.tsx`** (NOVO)
- Chips filtrados por `leadStage`
- Textarea editável após seleção
- Botão único "Copiar texto" com toast
- Header colapsável (ChevronDown/Up)
- Reset ao mudar de lead (via `useEffect` em `leadName`)
- Tokens semânticos (sem hex)

**`src/components/pipeline/focus/LeadContextPanel.tsx`**
- Adicionar `<ScriptsCard leadName={lead.name} leadEmpreendimento={lead.interest ?? undefined} leadStage={lead.stage} />` entre `PendingTasksCard` e `{children}`

### Preservado intacto

- TaskCompletionDialog R3-V2, useTimelineEvents, useFocusLeads (régua 4 estados)
- Telemetria, cache HOMI, BRT
- Top strip (CTA + Ligar Popover + WhatsApp verde)
- Sticky layout R3.6, timeline truncada
- Stage advance inline, Discard inline, botões Avançar Etapa / Descartar / Avançar próximo lead

### Ordem de execução

1. Criar `scriptsByStage.ts` (templates completos)
2. Criar `ScriptsCard.tsx`
3. Integrar em `LeadContextPanel.tsx`
4. Remover bloco Tabs de `FocusModeModal.tsx` + limpar órfãos
5. Build check + reporte com diff

### Estimativa
~1h30 (templates já especificados no prompt).

Aguardando aprovação.