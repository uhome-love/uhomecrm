

## Diagnóstico — bugs no fluxo entre etapas

Após varredura completa do `PipelineBoard`, `PipelineStageTransitionPopup`, `usePipeline.moveLead`, `useVisitas.createVisita`, `PipelineCard.handleMoveStage`, `PipelineMobileView` e `CardScheduleVisitDialog`:

### Bug 1 — Stages duplicadas no banco poluindo o kanban
A tabela `pipeline_stages` (pipeline_tipo='leads', ativo=true) tem **9 etapas válidas + 4 etapas duplicadas/legadas** vazias:
- ordem 3: `Busca` ✓ + `Qualificação` (legada, 0 leads)
- ordem 4: `Aquecimento` ✓ + `Possível Visita` (legada, 0 leads)
- ordem 5: `Visita` ✓ + `Visita Marcada` (legada, 0 leads)
- ordem 6: `Pós-Visita` ✓ + `Visita Realizada` (legada, 0 leads)

Isso polui o kanban (colunas vazias) e quebra a busca dinâmica em vários lugares (`stages.find(s => s.tipo === 'visita')` pode pegar a errada dependendo da ordem). 

**Fix:** desativar as 4 etapas legadas (`UPDATE pipeline_stages SET ativo=false WHERE id IN (...)`).

### Bug 2 — `PipelineCard.handleMoveStage` reabre popup mesmo com visita já agendada
`src/components/pipeline/PipelineCard.tsx` linhas 166-176: ao usar o menu "··· Mover para Visita", o card abre `CardScheduleVisitDialog` **sem checar `flag_status.status_visita`**, repetindo o bug que já corrigimos para drag-and-drop.

**Fix:** mesma checagem do `needsTransitionPopup` — se `lead.flag_status?.status_visita ∈ {marcada, confirmada, reagendada, agendada}`, chama `onMoveLead` direto.

### Bug 3 — `useVisitas.createVisita` insere em `pipeline_atividades` com colunas inexistentes
`src/hooks/useVisitas.ts` linhas 431-436 envia:
```ts
{ lead_id, tipo: "mudanca_etapa", descricao, corretor_id }
```
Mas o schema real é: `pipeline_lead_id`, `tipo`, `titulo`, `descricao`, `responsavel_id`, `status`, `created_by`. Não existe `lead_id` nem `corretor_id` nessa tabela. O insert falha silenciosamente (try/catch engole) — perde-se o registro no histórico de atividades.

**Fix:** trocar para colunas corretas: `pipeline_lead_id`, `titulo`, `descricao`, `responsavel_id: corretor_id`, `created_by: corretor_id`, `status: "concluida"`.

### Bug 4 — `PipelineStageTransitionPopup.needsTransitionPopup` não diferencia "Visita" de "Pós-Visita" / "Visita Realizada"
Linha 601 e 610: a regex `name === "visita"` é frágil — se o nome vier com espaços ou variações, escapa. Mais grave: linha 610 captura `name.includes("visita realizada")` ANTES de cair no else, mas a ordem dos `if` na linha 601 já trata `name === "visita"`. Nome "Pós-Visita" cai corretamente em `pos_visita`. **OK** após inspeção, mas vou reforçar usando `stageType` como fonte primária.

### Bug 5 — Drag para "Negócio Criado" não pede confirmação
`needsTransitionPopup` não tem case para `tipo === "convertido"`. O lead vai direto, criando negócio automaticamente sem confirmação humana — viola a memory `Business creation via 'Negócio Criado' stage only; never automatic`. Hoje é semi-automático mas sem confirmação prévia, e não há campo de VGV/observação no momento do move.

**Fix proposto (leve):** adicionar mini-popup de confirmação para a etapa "Negócio Criado" pedindo VGV estimado e observação opcional, antes de criar o negócio.

### Bug 6 — Insert em `lead_progressao` sem `auth_user_id`
A tabela tem coluna `auth_user_id` (provavelmente NOT NULL ou usada por RLS). O insert atual em `useVisitas` (linha 439-447) não envia. Pode estar falhando silenciosamente. Verificar e adicionar `auth_user_id: user.id`.

### Bug 7 — `PipelineMobileView` herda os mesmos bugs
A view mobile usa o mesmo `PipelineCard` e o mesmo `onMoveLead` → herda bug 2. Sem mudança adicional, basta corrigir o card.

## Correção

### Migration SQL
```sql
UPDATE pipeline_stages SET ativo = false 
WHERE id IN (
  '1ea43190-44c8-43ec-91b4-409b055b0e58', -- Qualificação dup
  '2096921e-f8c9-4212-91c8-dae055bc5710', -- Possível Visita dup
  'c9fcf0ad-dcab-4575-b91f-3f76610e4d44', -- Visita Marcada dup
  '5ad4f4aa-b66f-4dc2-ac90-97c55e846a14'  -- Visita Realizada dup
);
```

### Arquivos alterados

1. **`src/hooks/useVisitas.ts`**
   - Corrigir colunas do insert em `pipeline_atividades` (Bug 3)
   - Adicionar `auth_user_id` no insert de `lead_progressao` se necessário (Bug 6)

2. **`src/components/pipeline/PipelineCard.tsx`**
   - `handleMoveStage`: pular `CardScheduleVisitDialog` quando `flag_status.status_visita` indica visita já agendada (Bug 2)

3. **`src/components/pipeline/PipelineStageTransitionPopup.tsx`**
   - Reforçar checagem usando `stageType` como primário em `needsTransitionPopup` e `renderForm`
   - Adicionar form simples para `tipo === "convertido"` (Negócio Criado) — VGV + observação (Bug 5)

4. **`src/components/pipeline/PipelineBoard.tsx`**
   - Adicionar `tipo === "convertido"` no caminho de popup (Bug 5)

### Verificação visual (cenários)

1. Pipeline mostra apenas 9 colunas (sem duplicatas).
2. Agendar visita pela Agenda → lead vai para Visita + badge "📅 Marcada" + atividade registrada no histórico.
3. Arrastar lead com visita já marcada para Visita → move direto, sem popup.
4. Usar menu "··· Mover para Visita" com visita já marcada → também move direto.
5. Arrastar para "Negócio Criado" → abre popup pedindo VGV + observação antes de criar negócio.
6. Arrastar para Sem Contato / Contato Iniciado / Busca / Aquecimento / Pós-Visita / Descarte → popups continuam funcionando.

