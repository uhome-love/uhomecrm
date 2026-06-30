# Melhorias na página Leads Estagnados

Três melhorias na página `/leads-estagnados` (`src/pages/LeadsEstagnados.tsx`) para facilitar a decisão do gestor/CEO. Sem mudanças no banco, RLS ou edge functions — apenas frontend, reaproveitando o que já existe.

## 1) Clicar no cliente → abrir o histórico do lead

Hoje cada linha mostra só nome, etapa e corretor. Vamos tornar o nome/linha clicável para abrir o **mesmo drawer de detalhe do lead** usado no pipeline (`PipelineLeadDetail`), com timeline, tarefas, visitas, anotações e histórico completo — assim o gestor entende o contexto antes de decidir.

Como o card de estagnação carrega só dados resumidos, ao clicar buscamos o registro completo do lead (`pipeline_leads` por `id`) sob demanda e abrimos o drawer com ele. As ações de update/mover/excluir dentro do drawer funcionarão e, ao fechar, a lista de estagnados é recarregada para refletir qualquer mudança.

## 2) Filtros para facilitar a visualização

Adicionar uma barra de filtros acima da lista (dentro da aba atual):
- **Busca por texto** (nome, empreendimento, corretor)
- **Corretor** (dropdown com os corretores que têm leads na categoria)
- **Empreendimento** (dropdown)
- **Ordenação** por dias sem ação (maior → menor é o padrão) ou nome

Os filtros operam sobre os dados já carregados (client-side), sem nova chamada ao servidor, e funcionam junto com as abas de categoria existentes (Estagnados / Em aviso / Em parceria / Confirmados).

## 3) Decisões em múltipla seleção

Permitir selecionar vários leads e aplicar uma ação de uma vez:
- Um **checkbox** por linha + um "selecionar todos" no topo da lista.
- Quando há seleção, aparece uma **barra de ações em massa** mostrando "N selecionados" com os botões: **Repassar**, **Roleta** e **Descartar**.
- Reaproveita o mesmo `DecisionDialog` já existente, em modo lote:
  - **Repassar**: escolhe um corretor de destino único e aplica a todos.
  - **Roleta / Descartar**: confirma o motivo e aplica a todos.
- A execução chama o mesmo hook `useDecidirEstagnado` para cada lead selecionado (em sequência, com feedback de progresso), depois limpa a seleção e recarrega a lista. Um toast resume "X leads processados".

## Detalhes técnicos

- **Arquivo principal alterado:** `src/pages/LeadsEstagnados.tsx`.
- **Drawer:** reusar `src/components/pipeline/PipelineLeadDetail.tsx`. Ele exige um `PipelineLead` completo + `stages`/`segmentos` + callbacks `onUpdate/onMove/onDelete`. Para evitar carregar o pipeline inteiro, ao clicar buscamos o lead único e os `stages`/`segmentos` (queries leves, em cache via react-query). Callbacks fazem `update`/`move` direto em `pipeline_leads` e, no fechamento, `invalidateQueries(["pipeline-estagnacao"])`.
- **Filtros e seleção:** estado local (`useState`) + `useMemo`; nenhum novo hook de dados necessário além de reusar `useCorretoresOptions`.
- **Bulk actions:** estende o `DecisionDialog` para aceitar `leadIds: string[]` opcional além do `lead` único; loop sobre `useDecidirEstagnado.mutateAsync`.
- Sem migração, sem mudança em RLS/edge functions, sem alteração de regras de negócio (as ações continuam idênticas às atuais).
