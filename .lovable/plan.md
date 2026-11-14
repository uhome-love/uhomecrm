# Pipeline oficial: topo, colunas e filtros da página de teste, mais o pop-up de conclusão de tarefa mais compacto

## O que muda no Pipeline que os corretores usam
1. **Topo novo**, igual à página de teste:
   - Linha 1: título com o total de leads, as abas Equipes/Leads/Negócios, Meus/Empresa, Modo Foco e Novo lead.
   - Linha 2: busca, Corretores, Gestores, Filtros, Prioridade, Fila CEO, HOMI e Mais.
   - Linha 3: atalhos de tarefa ("Tarefa atrasada", "Para hoje", "Sem próxima ação", com a contagem de cada um) e a saúde (verde, amarelo e vermelho) à direita.
2. **Topo das colunas**, igual ao da página de teste: faixa colorida em cima, ícone da etapa, nome, contagem e botão para ordenar.
3. **Filtros de tarefa** funcionando no Pipeline oficial: um toque filtra, e um segundo toque no mesmo filtro tira o filtro.
4. **Os cartões não mudam**: o cartão atual continua exatamente igual.
5. **No celular** o Pipeline segue como está hoje. Só entram os atalhos de tarefa, se couberem sem apertar.

## Pop-up "Concluir tarefa" mais compacto
O pop-up hoje ocupa a tela inteira. A proposta:
- Cabeçalho com o nome da tarefa e do lead em uma linha.
- Resultado e observação em cima. A observação começa com 2 linhas e cresce conforme o corretor escreve.
- Status da qualificação em uma linha só, sem caixa em volta e sem texto de ajuda.
- "Próxima ação": os botões rápidos ficam em uma fileira só, com rolagem para o lado. Logo abaixo, os atalhos de data (Hoje +2h, Amanhã 10h, +2 dias, +7 dias) já aparecem.
- Ficam guardados em "Mais opções", fechado por padrão: tipo, data e hora manual, mover etapa e detalhes.
- Botões Cancelar e Concluir sempre visíveis no rodapé.
- Objetivo: caber sem rolagem num notebook comum e ocupar no máximo 85% da tela do celular.

As regras não mudam: resultado, observação e próxima tarefa continuam obrigatórios e são gravados do mesmo jeito.

## Ordem de trabalho
- **Fase 0:** desenho do pop-up novo (computador e celular) para sua aprovação.
- **Fase 1:** topo, colunas e filtros no Pipeline oficial, com validação no computador e no celular.
- **Fase 2:** pop-up compacto, testado com lead de teste e sempre cancelando no fim.

## Detalhes técnicos
- `PipelineKanban.tsx` passa a usar `PipelineHeaderV2` e o estado `acaoFilter` com `contarAcoes`/`filtrarPorAcao` (`src/lib/pipelineV2/proximaAcao.ts`), como em `PipelineKanbanV2`.
- `PipelineBoard.tsx` passa a usar `ColunaCabecalhoV2`/`colunaEstiloV2` e mantém `CardMinimal`.
- O pop-up muda em `task-completion/CompletionForm.tsx` (1311 linhas): a parte de "Próxima ação" vai para um componente próprio e a parte avançada fica num bloco recolhível. Sem mudança na gravação.
- Nenhuma mudança no banco. A página `/pipeline-v2` continua como teste.
