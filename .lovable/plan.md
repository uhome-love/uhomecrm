## Diagnóstico

Identifiquei dois bugs no `src/hooks/usePipeline.ts` que causam exatamente o que você descreve:

### 1) Pipeline fica recarregando sem parar + "Failed to fetch"

No `usePipeline.ts`:

- **Linha 95** — `discardStageIds = new Set(...)` é recriado **a cada render** (sem `useMemo`).
- Isso faz `shouldHideLeadFromPipeline` (linha 97, com `useCallback` que depende de `discardStageIds`) também mudar a cada render.
- Por consequência, `loadLeads` (linha 160, depende de `shouldHideLeadFromPipeline`) muda a cada render.
- O `useEffect` da linha 341 tem `loadStages, loadSegmentos, loadLeads` nas dependências → dispara **a cada render** → setState dentro do load → novo render → novo fetch → **loop infinito**.

Os erros `TypeError: Failed to fetch` do console são consequência: o navegador/rede está saturado de requests duplicados e começa a abortar.

Pioram a situação:
- `loadStages` depende de `stages.length`
- `loadSegmentos` depende de `segmentos.length`
- `loadLeads` depende de `leads.length`

Cada `setStages/setSegmentos/setLeads` muda o `.length` → recria a callback → re-roda o effect.

### 2) "Aparece 50 desatualizados e depois corrige"

No `src/pages/PipelineKanban.tsx` linha 246, `clientStatusCounts` usa `stageTypeById` (montado de `pipeline.stages`). Quando os leads chegam **antes** das stages (cenário comum no `Promise.allSettled` da linha 357 do hook), `stageTypeById[l.stage_id]` é `undefined` → `getLeadStatusFilter` não consegue reconhecer stages de descarte/inativado/venda → classifica como "desatualizado". Quando as stages finalmente chegam, recalcula e o número cai.

---

## Plano de correção

### Arquivo 1: `src/hooks/usePipeline.ts`

1. **Memoizar `discardStageIds`** com `useMemo` dependendo apenas de `stages`.
2. **Remover `stages.length`, `segmentos.length`, `leads.length`** das dependências de `loadStages`, `loadSegmentos`, `loadLeads`. Substituir o "só substitui se houver dados" usando refs (`stagesRef`, `segmentosRef`, `leadsRef`) atualizadas em cada `set*`. As callbacks ficam estáveis.
3. **Manter `shouldHideLeadFromPipeline`** estável: continuar com `useCallback` mas agora `discardStageIds` é estável → callback estável.
4. **Garantir ordem stages → leads** no init: trocar o `Promise.allSettled([loadStages, loadSegmentos, loadLeads])` por:
   - `await loadStages()` primeiro (crítico — define filtro de descarte).
   - Depois `Promise.allSettled([loadSegmentos(), loadLeads()])` em paralelo.
   
   Isso evita o flicker da contagem (bug #2) sem precisar tocar no PipelineKanban e também evita o transitório onde `shouldHideLeadFromPipeline` filtra com `discardStageIds` vazio.
5. **useEffect de init**: deps passam a ser apenas `[userId, roleLoading, pipelineTipo]` (callbacks agora são estáveis e referenciadas por ref no escopo do effect — usando uma ref que sempre aponta para a versão atual).

### Arquivo 2: `src/pages/PipelineKanban.tsx` (defesa em profundidade)

6. Em `clientStatusCounts` (linha 246), retornar zeros quando `pipeline.stages.length === 0` — evita exibir contagens calculadas com `stageTypeById` incompleto, mesmo se a ordem do hook falhar.

### O que NÃO mudar

- Mantém realtime, retry, paginação, parcerias, snapshot de stale, sem tocar.
- Sem alterar `taskQueryUtils.ts` nem o cliente Supabase (regra Core memory).
- Sem alterar a estrutura visual nem rotas.

### Validação

- Abrir `/pipeline-leads` e confirmar no console: nenhum loop de "Error loading stages/segmentos".
- Contagem de "Desatualizados" deve aparecer já correta no primeiro render (sem cair de 50 → N).
- Recarga manual e mudança de aba continuam funcionando normal.
