# Fase 3b — Filtro de período padrão, uma página por vez

## Objetivo
Trocar o visual do filtro de período das 5 páginas que ainda têm filtro próprio pelo seletor padrão do CRM, sem mudar nenhuma conta, número ou regra de data.

## Regra de ouro
- Só muda a aparência do botão. O cálculo das datas de cada página continua exatamente o mesmo.
- Cada página mantém as opções que já tem (ex.: Visitas mantém "Próxima semana"; Reengajamento continua só Hoje/Semana/Dia escolhido). Nenhuma opção é removida ou acrescentada.
- Uma página por vez, nesta ordem, e só passo para a próxima depois de conferir a anterior:
  1. Visitas
  2. Ranking (Performance)
  3. Relatório de Origem
  4. Ranking da Oferta Ativa
  5. Reengajamento

## Como cada página é conferida
Para cada página, antes e depois da troca, com a sua conta e sem alterar dado nenhum:
1. Abrir a página e anotar os números mostrados em cada período (Hoje, Semana, Mês e os demais que existirem).
2. Fazer a troca do visual.
3. Abrir de novo, clicar em cada período e comparar: os números precisam ser idênticos.
4. Abrir "Personalizado" e conferir que a escolha de datas continua funcionando (sem aplicar nada que grave).
5. Conferir que o CRM continua sem erros.
Se algum número mudar, desfaço a troca daquela página e aviso antes de seguir.

## Ao final
Mensagem curta com o resultado de cada página (números conferidos antes/depois) e prints.

## Detalhes técnicos
- `src/components/ui/PeriodSelector.tsx` passa a aceitar uma lista genérica de opções `{ value, label }` (além das padrão), para cada página usar seus próprios valores (`proxima-semana`, `custom`, etc.) sem converter tipos.
- Páginas e pontos de troca:
  - `src/pages/AgendaVisitas.tsx` — `PERIOD_OPTIONS` (botões renderizados pela página).
  - `src/pages/RankingEquipe.tsx` — hoje usa as abas do `PageHeader` como filtro; passa para o seletor padrão logo abaixo do cabeçalho.
  - `src/pages/RelatorioOrigemPerformancePage.tsx` — lista local de períodos.
  - `src/components/oferta-ativa/RankingOfertaAtiva.tsx` — botões Hoje/Semana/Mês.
  - `src/components/central-nutricao/PeriodFilter.tsx` — botões Hoje/Semana; o calendário de dia escolhido continua igual.
- Nenhuma alteração em consultas, hooks, funções do servidor ou banco.
- Conferência via navegador automatizado com a sessão do Lucas, lendo os números da tela em cada período.
