## Problema

Na visão CEO do Pipeline (aba Kanban), os leads ficam "atualizando sem parar" — os contadores **em dia / sem tarefa / atrasado** piscam continuamente e a contagem de leads muda sozinha, impossibilitando olhar ou mexer nos leads.

## Causa raiz

`src/hooks/usePipeline.ts` mantém uma assinatura realtime que escuta **toda** a tabela `pipeline_leads` (`event: "*"`, sem filtro). 

- Para um corretor: recebe poucos eventos (só os leads dele) → ok.
- Para o CEO: ~2.400 leads da empresa inteira carregados, e os automatismos de fundo (roleta, nutrição, reengajamento, dispatches, crons) escrevem nessa tabela constantemente. Cada lote de eventos chama `setLeads(...)`, o que muda a referência da lista → recalcula `preFilteredLeads` → refaz a query `pipeline-kanban-tarefas` → recalcula os contadores → re-renderiza o board. Em escala company-wide isso vira flicker contínuo.

## Correção proposta

Desligar a atualização realtime automática quando o escopo for a empresa inteira (visão CEO/gestor sem filtro), mantendo-a para o corretor. O CEO continua com o botão de atualizar manual e o `StaleDataBadge` já existentes.

### Passo 1 — `usePipeline` aceita flag de realtime
- Adicionar à assinatura de opções: `options?: { scopeCorretorIds?: string[] | null; realtime?: boolean }`.
- Default seguro: `const realtimeEnabled = options?.realtime ?? true;` (mantém comportamento atual para todos os outros consumidores).
- No `useEffect` da assinatura realtime (linhas ~462-526): retornar cedo quando `!realtimeEnabled` (não criar o channel) e incluir `realtimeEnabled` nas dependências.

### Passo 2 — `PipelineKanban` desliga realtime no escopo company-wide
- Onde hoje chama `usePipeline("leads", { scopeCorretorIds: pipelineScopeCorretorIds })` (linha ~96), passar também `realtime`.
- Condição de desligar (firehose): visão de alto volume sem escopo de corretor próprio — quando `isAdmin` (CEO) ou `isGestor` e o escopo não está restrito a um time específico pequeno. Regra prática: `realtime: !(isAdmin || isGestor)` → realtime só para corretor. (Mantém a vista do corretor reativa, que é onde a UX em tempo real importa de fato.)

### Passo 3 — Reforçar atualização manual para o CEO
- Garantir que o botão de atualizar (`handleRefresh` → `pipeline.reload()`) fique visível/claro na visão CEO, já que ela deixa de ser tempo-real. (Já existe; apenas confirmar.)

## Resultado esperado

- CEO: a lista para de piscar; contadores ficam estáveis; dá para filtrar, abrir e mexer nos leads. Atualização sob demanda pelo botão de refresh.
- Corretor: comportamento inalterado (realtime continua ativo na carteira própria).

## Validação

1. Abrir Pipeline → aba Kanban como CEO e confirmar que os contadores param de oscilar e o board fica interativo.
2. Confirmar que o botão de atualizar traz dados frescos.
3. Logar como corretor e confirmar que um lead alterado ainda atualiza em tempo real.

## Detalhe técnico

Arquivos afetados:
- `src/hooks/usePipeline.ts` — nova opção `realtime`, guard no `useEffect` da assinatura `pipeline-leads-realtime`.
- `src/pages/PipelineKanban.tsx` — passar `realtime: !(isAdmin || isGestor)` ao `usePipeline`.

Nenhuma migração de banco ou mudança de RLS necessária.