## Diagnóstico
- Existem **1.807 leads ativos** no pipeline; os dados estão no banco.
- O gargalo está no frontend: o CEO carrega todos os leads com muitas colunas, espera a carga inteira terminar, depois ainda busca nomes, tarefas, WhatsApp e cadências em muitos chunks.
- A consulta de `pipeline_leads` do CEO aparece entre as queries mais pesadas do backend, e o spinner fica preso até tudo terminar.
- O erro de `segmentos` visto no console é secundário; não deve impedir o Kanban.

## Plano de correção
1. **Deixar o Kanban abrir progressivamente para CEO**
   - Manter stages como requisito mínimo.
   - Liberar a tela assim que a primeira carga útil de leads chegar, em vez de esperar todos os lotes e dados auxiliares.
   - Continuar carregando o restante em background até completar os 1.807 leads.

2. **Reduzir o payload inicial de leads**
   - Ajustar `usePipeline.ts` para carregar no Kanban só os campos necessários para cartões, filtros e contadores.
   - Dados mais pesados/complementares ficam para o drawer do lead quando abrir o detalhe.

3. **Não bloquear a tela por nomes de corretores**
   - Mover a resolução de `corretorNomes`/avatars para depois do `setLeads`, sem segurar o spinner principal.
   - Se falhar, o Kanban continua utilizável e tenta atualizar no próximo reload.

4. **Reduzir rajada de consultas auxiliares no Kanban**
   - Em `PipelineKanban.tsx`, aumentar o tamanho dos chunks de tarefas e limitar concorrência para evitar dezenas de chamadas simultâneas.
   - Em `PipelineBoard.tsx`, limitar/adiar consultas de WhatsApp não lido e cadência para não competir com a carga principal.

5. **Corrigir timeouts que geram falso travamento/falha**
   - Remover ou aumentar o timeout curto de `loadLeads` para CEO, porque hoje ele pode marcar falha enquanto a consulta real ainda está rodando.
   - Manter erro acionável apenas quando stages/leads iniciais realmente falharem.

6. **Validação obrigatória**
   - Testar no preview autenticado como CEO em `/pipeline-leads`.
   - Confirmar que o spinner sai rápido, o Kanban aparece, e o total de leads carregados chega ao volume esperado.
   - Conferir console/network para garantir que não há loop, timeout ou `Partial load failure` crítico.

## Escopo
- Primeira tentativa será **somente código frontend**, sem migration.
- Só proponho ajuste de índice no banco se, após a validação, a consulta continuar lenta apesar da redução de payload e concorrência.