# Fase 5 — Toolbar unificada + modularização PDN

Objetivo: colocar Planilha e Kanban debaixo da MESMA barra de filtros/ações, remover duplicidade (filtros locais do Kanban x filtros da Planilha) e começar a quebrar o `PdnGestor.tsx` (1192 linhas hoje) em blocos coesos.

## O que muda

### 1. Toolbar única (`PdnToolbar.tsx`)
Um único componente sticky logo abaixo do header, usado tanto por Planilha quanto por Kanban. Contém:
- Toggle "Em risco" (já existe global)
- Filtro Equipe (visível só p/ diretor/admin — mantém regra atual)
- Filtro Corretor
- Novo filtro "Novos desde ontem" (hoje só existe no Kanban)
- Novo filtro "Atualizado hoje" (aproveita `pipeline_leads.updated_at` / `visita_eventos.created_at` <24h) — reutiliza o pulso verde da Fase 4
- Contador "N negócios · R$ X" à direita
- Botão "Colunas" (só aparece quando view === planilha)

O `KanbanToolbar.tsx` (Fase 3) some — filtros ficam globais e a seleção de corretor deixa de ser duplicada.

### 2. Estado de filtro elevado
Move os filtros locais (`filters` do Kanban, `filtroCorretor/Risco/Equipe` da Planilha, `kpiFilter`) para um único hook `usePdnFilters` — persistido em `sessionStorage` por device. Kanban e Planilha consomem o mesmo estado, então trocar de view preserva o que o gestor filtrou.

### 3. Extração de componentes do `PdnGestor.tsx`
Quebra pontual, sem mudar comportamento:
- `PdnHeader.tsx` — título + selector de mês + toggle Planilha/Kanban + Atualizar + Exportar
- `PdnKpiCards.tsx` — os 5 cards de resumo (VGV/Ganhos/Contrato/Forecast/Risco) já clicáveis
- `PdnResumoEquipes.tsx` — o bloco "Resumo por equipe" (colapsável)
- `PdnToolbar.tsx` — a barra do item 1

Meta: `PdnGestor.tsx` cai de ~1192 para <700 linhas. Nenhum arquivo novo passa de 300.

### 4. Badge "atualizado hoje" — reaproveitamento
A Fase 4 já detecta atualização via realtime; o campo `atualizadoHoje` sai do próprio row (deriva de `updated_at` no `usePdn`). Kanban e planilha usam o mesmo campo.

## Arquivos afetados

- `src/pages/PdnGestor.tsx` — enxuga imports, delega para os 4 componentes novos.
- `src/components/pdn/PdnHeader.tsx` — novo
- `src/components/pdn/PdnKpiCards.tsx` — novo
- `src/components/pdn/PdnResumoEquipes.tsx` — novo
- `src/components/pdn/PdnToolbar.tsx` — novo
- `src/hooks/pdn/usePdnFilters.ts` — novo (estado compartilhado + persistência)
- `src/components/pdn/PdnKanban.tsx` — passa a receber filtros por prop; remove `KanbanToolbar`.
- `src/components/pdn/kanban/KanbanToolbar.tsx` — deletado.
- `src/hooks/usePdn.ts` — expõe `atualizadoHoje` no `PdnRow`.

## Backend

Nenhuma mudança. Já temos `updated_at` e `visita_eventos.created_at`.

## Fora de escopo (Fase 6 em diante)

- Permissões finas (diretoria x gerente x CEO) — Fase 7.
- Nova aba "Meta do mês" no PDN.

## Validação ponta-a-ponta

1. Abrir /pdn → toolbar única aparece; toggles funcionam em ambas views.
2. Filtrar por Corretor na Planilha → trocar para Kanban → mesmo filtro está aplicado.
3. Marcar "Novos desde ontem" → 2 views mostram só os mesmos ids.
4. Recarregar página → filtros persistem (session).
5. `PdnGestor.tsx` compila e passa `wc -l` <700.
