## Objetivo

Deixar o PDN (planilha + Kanban) 100% funcional, moderno e completo para o gestor gerir os negócios, sem alterar o pipeline do corretor.

## O que muda

### 1. VGV formatado em BRL na edição
Hoje o campo VGV é um `<input type="number">` cru (mostra `250000`). Vou criar um componente `MoneyInput` que:
- Exibe o valor formatado em BRL enquanto edita (`R$ 250.000`).
- Aceita digitação natural, faz o parse para número no commit (blur/Enter).
- Ganha largura adequada (`w-[130px]`) para caber o valor completo sem cortar.
- Usado na planilha (célula VGV), no drawer do Kanban e no card manual.

### 2. Colunas da planilha redimensionáveis
- Adicionar redimensionamento por arrastar a borda do cabeçalho (drag handle no `<th>`).
- Larguras persistidas em `sessionStorage` (`pdn:colWidths`) por coluna.
- Botão "Redefinir larguras" quando houver ajustes.
- Larguras padrão pensadas para caber conteúdo (Nome, Data, Empreendimento, VGV, Corretor, Status, Observação).

### 3. Botão "Atualizar"
- Hoje `reload` só recarrega o overlay (`pdn_entries`), não busca novos negócios do pipeline.
- Expor no hook um `refreshAll()` que roda `loadDeals()` + `loadEntries()` em paralelo (busca os últimos negócios que entraram em cada etapa: Visita, Em Negociação, Contrato, Ganho).
- Botão "Atualizar" no header com ícone de refresh e estado de carregando (spin). Funciona tanto na planilha quanto no Kanban.

### 4. Resumo por corretor clicável + agrupado por equipe
- No rodapé "Resumo por corretor", cada card vira clicável: ao clicar, aplica `filtroCorretor` = aquele corretor (e destaca o card ativo). Clicar de novo limpa.
- Agrupar os cards por equipe: um subtítulo por equipe, com subtotal de VGV e nº de negócios da equipe, e os corretores daquela equipe abaixo.
- Corretores sem equipe vão para um grupo "Sem equipe".
- Ordenação: equipes por VGV desc; dentro da equipe, corretores por VGV desc.

### 5. Melhorias de qualidade (Kanban + planilha)
- **Kanban — resumo de corretor/equipe** no rodapé de cada coluna já existe VGV total; adicionar contagem "em risco" e "novos" por coluna quando houver.
- **Kanban — filtros aplicados**: garantir que o Kanban recebe `filtered` (já recebe) e reflete filtro por corretor/equipe/risco corretamente ao clicar no resumo.
- **Kanban — feedback de drag**: manter arraste para "Caídos" (marca queda) e reativar ao arrastar para fora; deixar claro visualmente com highlight (já existe) e cursor.
- **Kanban — botão Atualizar** compartilhado com a planilha.
- **Empty states** e contadores consistentes entre as duas visões.
- Validar que salvar empreendimento/VGV/status no drawer atualiza o card imediatamente (já usa `selectedLive`).

## Detalhes técnicos

- `src/lib/fmtMoney.ts`: reaproveitar; criar helper `parseMoney(str): number` e `formatMoneyInput(n): string` (ou colocar o `MoneyInput` inline em PdnGestor e importar no drawer).
- `src/hooks/usePdn.ts`: adicionar `refreshAll` ao retorno (Promise que aguarda `Promise.all([loadDeals(), loadEntries()])`); expor `loadDeals` via callback já existente.
- `src/pages/PdnGestor.tsx`:
  - Novo `MoneyInput` (substitui `EditableCell type="number"` no VGV).
  - Estado `colWidths` + handlers de resize no `SortHeader`/`TableHead` do `GrupoBloco`.
  - Botão "Atualizar" no header (com `isRefreshing`).
  - Reescrever bloco "Resumo por corretor" para agrupar por equipe e tornar clicável (usa `setFiltroCorretor`).
- `src/components/pdn/PdnKanban.tsx` e `PdnCardDrawer.tsx`: trocar input de VGV por `MoneyInput`; ajustar rodapé das colunas com contadores.

## Fora de escopo
Nenhuma mudança no pipeline do corretor, em `negocios` ou `pipeline_leads`. Sem migração de banco (a coluna `oculto` e campos de overlay já existem).