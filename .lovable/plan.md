## Problema

No Pipeline (aba Kanban), os contadores de status ficam em looping:
`49 sem tarefa` → `33 em dia / 17 atrasado` → volta para `49 sem tarefa` → repete.
Além disso, quando o corretor atualiza uma tarefa, às vezes não reflete para o gestor.

## Causa raiz

A classificação de cada lead (em dia / sem tarefa / atrasado) depende de um **segundo fetch** separado: a query `pipeline-kanban-tarefas` (em `PipelineKanban.tsx`, ~linha 243), que busca a próxima tarefa pendente de cada lead via `fetchInBatchesWithRetry`.

O `fetchInBatchesWithRetry` (`src/lib/taskQueryUtils.ts`) **engole erros de rede**: quando os chunks falham (Wi-Fi residencial flapando), ele resolve com `rows: []` + `errors: [...]` em vez de lançar erro. A `queryFn` ignora `errors` e retorna um **mapa de tarefas vazio/incompleto como se fosse sucesso**.

Resultado: o React Query sobrescreve o cache bom por um mapa vazio → `getLeadStatusFilter` classifica todos os leads sem tarefa como "sem tarefa" (49) → o refetch seguinte repopula → `33 em dia / 17 atrasado` → próximo flap esvazia de novo. Esse é exatamente o looping observado.

A mitigação atual (`clientStatusCountsReady` + `lastStableClientStatusCountsRef`) não pega esse caso porque a query **resolve com sucesso** (`isLoading=false`, `data={}`), então a UI considera os contadores "prontos" e mostra o mapa vazio.

## Correção

### 1. Não sobrescrever dados bons com mapa incompleto — `src/pages/PipelineKanban.tsx`
Na `queryFn` da query `pipeline-kanban-tarefas`:
- Se `errors.length > 0`, **lançar erro** (`throw`) em vez de retornar o mapa parcial. Assim o React Query mantém o último mapa válido em cache em vez de gravar um mapa vazio. O retry nativo do React Query cuida da nova tentativa.
- Adicionar `placeholderData: keepPreviousData` (import de `@tanstack/react-query`) para que, em qualquer refetch/mudança de key, os contadores **não voltem a zero/vazio** durante o carregamento — exibem o último valor bom até chegar o novo.

### 2. Considerar "mapa vazio com leads presentes" como não-pronto — `src/pages/PipelineKanban.tsx`
Reforçar `clientStatusCountsReady` (~linha 422) para também exigir que o mapa não esteja vazio quando há leads:
- Se `leadIds.length > 0` e o mapa de tarefas estiver vazio, tratar como **não pronto** e manter `lastStableClientStatusCountsRef`. Isso evita o flash "tudo sem tarefa" mesmo num caso de borda em que a query resolva vazia. (No primeiro load legítimo sem nenhuma tarefa, o estado estável inicial já é zero, então não há regressão visível.)

### 3. Atualização do corretor refletir para o gestor — `src/pages/PipelineKanban.tsx`
No `handleRefresh` (~linha 435), além de `pipeline.reload()` (que só recarrega leads), invalidar também a query de tarefas:
- `queryClient.invalidateQueries({ queryKey: ["pipeline-kanban-tarefas"] })`
Assim o botão "Atualizar" do gestor traz o estado novo das tarefas concluídas/editadas pelos corretores (a mutação do corretor já chama `invalidateTaskQueries`, mas como o gestor está com realtime desligado, ele depende do refresh/focus — que agora fica confiável). O `refetchOnWindowFocus` já existente passa a repopular de forma estável graças ao item 1.

## Resultado esperado

- Abriu o Pipeline → carrega os contadores de cada estágio uma vez e estabiliza.
- Atualizou um lead/tarefa → contagem atualiza uma vez e mantém.
- Sem rede instável "zerando" o mapa de tarefas e criando o vai-e-volta entre "sem tarefa" e "em dia/atrasado".
- Gestor vê as tarefas atualizadas pelos corretores ao focar a aba ou clicar em Atualizar.

## Validação

1. Abrir Pipeline como gestor/CEO com escopo de um time e confirmar que os contadores param de oscilar.
2. Simular flap de rede (DevTools throttling/offline curto) e confirmar que os contadores mantêm o último valor bom em vez de pular para "todos sem tarefa".
3. Corretor conclui/edita uma tarefa → gestor clica em Atualizar (ou volta o foco à aba) → status do lead reflete corretamente.

## Detalhe técnico

Arquivos afetados:
- `src/pages/PipelineKanban.tsx` — `throw` em erro parcial na `queryFn` de tarefas, `placeholderData: keepPreviousData`, reforço de `clientStatusCountsReady`, invalidação de tarefas no `handleRefresh`.

Nenhuma migração de banco, mudança de RLS ou alteração em `usePipeline.ts` necessária (a opção `realtime` já existente continua igual).