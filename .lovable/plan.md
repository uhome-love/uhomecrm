## Objetivo

Deixar o PDN com **dois modos de visualização** (Planilha, que já existe, + Kanban novo), reforçar que a edição do gestor é 100% interna (sem afetar o corretor) e confirmar/documentar a atualização automática. Além disso, adicionar melhorias de gestão focadas no gerente conduzir os negócios independentemente do pipeline do corretor.

## O que já existe hoje (nada a refazer)

- **Edição sem afetar o corretor**: tudo que o gestor edita (status, observação, próxima ação, VGV, empreendimento, "caiu"/motivo) é gravado na camada `pdn_entries`, separada do pipeline/negócio. O dado do corretor é só leitura.
- **Atualização automática**: o PDN lê ao vivo de `visitas` (status realizada) e `pipeline_leads` + `negocios` (Em Negociação / Contrato / Ganho). A cada recarga reflete o dia. A camada manual fica por cima, sem ser sobrescrita.

Ou seja, das 3 perguntas, duas já estão atendidas — o plano foca no Kanban e nas melhorias.

## Mudanças

### 1. Toggle Planilha / Kanban
No cabeçalho do PDN, adicionar um seletor de modo (dois botões: "Planilha" e "Kanban"), persistido em `sessionStorage` (`pdn:view`). Todos os filtros/KPIs atuais (mês, equipe, corretor, em risco, recorte) continuam valendo nos dois modos.

### 2. Board Kanban (5 colunas = grupos atuais)
Colunas na ordem da jornada: **Visita Realizada → Em Negociação → Contrato → Ganho → Caídos**, com as mesmas cores dos grupos.

Cada card mostra: nome do cliente, empreendimento, VGV, corretor/equipe, badge de status interno, chip "⚠️ Em risco" quando aplicável, e dias parado.

Interações:
- **Arrastar card entre colunas = apenas gestão interna** (grava em `pdn_entries`), sem tocar no pipeline do corretor. Arrastar para "Caídos" abre o diálogo de motivo já existente; arrastar de volta reativa.
- **Clicar no card** abre um painel lateral (drawer) para editar status, observação, próxima ação e VGV — os mesmos campos da planilha.
- Rodapé de cada coluna com total de negócios e VGV somado.

Técnica: componente novo `src/components/pdn/PdnKanban.tsx` + `PdnCard.tsx` + drawer `PdnCardDrawer.tsx`, consumindo o mesmo `usePdn`. Drag & drop com a lib já usada no projeto (a mesma do pipeline de leads, para manter consistência). A página `PdnGestor.tsx` passa a renderizar planilha ou kanban conforme o toggle. Sem mudanças de banco.

### 3. Melhorias de gestão para o gerente (independente do corretor)

- **Próxima ação com data + alerta**: hoje "próxima ação" é texto livre. Adicionar um campo de data opcional (`proxima_acao_data` em `pdn_entries`) e destacar em vermelho quando vencida — ajuda o gestor a cobrar cada negócio.
- **Prioridade do negócio (foco do gestor)**: campo próprio (Alta / Média / Baixa) só do gestor, com uma coluna/filtro "Foco do gestor" para puxar os prioritários pro topo.
- **Motivo de risco explícito**: além do "em risco automático (parado +7d)", permitir o gestor marcar/limpar risco manualmente com uma nota curta.
- **Resumo por corretor/equipe**: um bloco compacto no topo com VGV e nº de negócios por corretor da equipe, para o gestor ver rapidamente quem está carregando o forecast.
- **Indicador "novo desde ontem"**: marcar visualmente cards que entraram no PDN nas últimas 24h (visita realizada nova ou negócio novo), para o gestor perceber o movimento diário sem comparar manualmente.

As melhorias do item 3 que exigem campos novos (`proxima_acao_data`, `prioridade`) entram em **uma migration** apenas na tabela `pdn_entries` (camada do gestor) — nada toca o pipeline do corretor.

## Detalhes técnicos

- `pdn_entries`: adicionar colunas `proxima_acao_data date null` e `prioridade text null` (via migration; grants já existentes na tabela permanecem). RLS atual do gestor é mantida.
- `usePdn`: expor os novos campos em `PdnRow`, incluir no `saveOverride`/`updateManualRow`, e calcular `novoDesdeOntem` e `proximaAcaoVencida`.
- Reaproveitar `EditableCell`, `StatusSelector`, `ObsSelector`, `QuedaDialog` já existentes tanto na planilha quanto no drawer do kanban (sem duplicar lógica de salvamento).
- Nenhuma alteração em `pipeline_leads`, `negocios` ou `visitas`.

## Fora de escopo
- Não mover negócios no pipeline do corretor a partir do PDN.
- Não alterar como o corretor vê ou trabalha os leads.