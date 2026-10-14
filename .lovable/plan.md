# Ordenar e filtrar cada etapa do Pipeline separadamente

## O que muda para o corretor
Cada coluna do Pipeline ganha um ícone pequeno de ordenar ao lado do nome (ex.: "Qualificação 120 ⇅"). Cada coluna guarda a sua escolha, sem mexer nas outras.

Opções de cada coluna:
- Mais recente: lead que chegou por último no topo
- Mais antigo: lead que chegou primeiro no topo
- Mais tempo sem contato: quem está há mais dias sem conversa no topo
- Mais atualizado: quem teve a conversa mais recente no topo
- Mais atrasado: tarefa vencida há mais tempo no topo, depois os leads sem próximo passo
- Padrão: segue o botão geral de ordenar que já existe

Filtro rápido por subetapa (no mesmo menu, só nas etapas que têm subetapa):
- Qualificação: Contato inicial / Alinhamento de perfil / Busca / Follow-up / Alinhando visita
- Aquecimento: 30 / 60 / 90 dias
- Visita, Em Negociação e Contrato: as subetapas que já existem

Quando a coluna está com ordenação ou filtro diferente do padrão, o ícone fica destacado e o número da coluna mostra quantos aparecem (ex.: "34 de 120"). Um botão "Limpar" volta ao padrão.

## Ordem de trabalho (regra do projeto)
1. Mockup do topo da coluna com o menu aberto, para sua aprovação.
2. Build, só depois do mockup aprovado.
3. Teste no preview com um corretor de teste: ordenar e filtrar Qualificação e Aquecimento, conferir que as outras colunas não mudam, que o arrastar entre colunas continua funcionando e que a escolha fica salva ao recarregar. Nenhum lead real é alterado (só visualização).

## Detalhes técnicos
- Novo componente `StageSortFilterMenu` no cabeçalho da coluna do board (PipelineKanban / coluna).
- Preferência por etapa salva em localStorage (`pipeline-stage-view:<stageId>`) — só tela, sem migration, sem mudança no banco.
- Ordenação reaproveita os campos já usados pelo `PipelineSortDropdown` (data de entrada, última ação humana, próxima tarefa); "Padrão" delega ao sort global.
- Filtro de subetapa usa `flag_status` e as listas centralizadas em `leadHelpers.ts`.
- Aplicado no lado do cliente sobre os leads já carregados da coluna; não altera paginação nem a distribuição.
