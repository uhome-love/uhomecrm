

## Plano: Central de Relatórios (`/central-relatorios`)

A rota `/relatorios` já existe (Relatórios 1:1). A nova Central de Relatórios usará `/central-relatorios`.

### Arquivos a criar

**1. `src/pages/ReportCenter.tsx`**
- Componente principal que monta layout: topbar com tabs + filtros + conteúdo
- Redirect para `/pipeline-leads` se role === corretor (via `useUserRole`)
- Filtros via `useSearchParams` (periodo, equipe, corretor, segmento)
- Background `#f0f0f5`

**2. `src/components/relatorios/ReportTabs.tsx`**
- 11 tabs horizontais: Vendas, Leads, Negócios, Oferta Ativa, Conversão, Empreend., Origem, Interação, Visitas, Tarefas, ✦ Mega
- Tab ativa: `color #4F46E5`, `border-bottom 2px solid #4F46E5`
- Tab "✦ Mega": sempre `color #4F46E5`
- Scroll horizontal no mobile

**3. `src/components/relatorios/ReportFilters.tsx`**
- Chips de período: Hoje / Esta semana / Este mês / Personalizado (date range picker)
- Active chip: `bg #EEF2FF`, `color #4F46E5`
- Select Equipe: busca profiles com role=gestor (visível só para admin)
- Select Corretor: filtrado pela equipe selecionada
- Select Segmento: Todos / MCMV / Médio-Alto / Altíssimo / Investimento
- Botão "Exportar PDF" (placeholder) + botão "🔗 Link" (copia URL)
- Gestor: equipe fixada, só vê corretores da própria equipe

**4. `src/components/relatorios/ReportPlaceholder.tsx`**
- Renderiza "Relatório [nome] em construção" com ícone

### Arquivos a modificar

**5. `src/config/pageRegistry.ts`**
- Adicionar `"report-center"` em `PAGE_COMPONENTS` apontando para `@/pages/ReportCenter`
- Adicionar `/central-relatorios` em `ROUTE_TO_TAB` com key `report-center`, roles `["gestor", "admin"]`

**6. `src/components/layout/Sidebar.tsx`**
- Seção "Performance" do admin: adicionar `{ label: "Central de Relatórios", path: "/central-relatorios", icon: <BarChart2 size={15} strokeWidth={1.5} /> }`
- Seção "Performance" do gestor: idem

### Controle de acesso
- `ROUTE_TO_TAB` com `roles: ["gestor", "admin"]` bloqueia via tab system
- Dentro do componente: se corretor, `Navigate` para `/pipeline-leads`

### Design
- Topbar/filtros: fundo branco, `border-bottom: 0.5px solid #e5e7eb`
- Fundo página: `#f0f0f5`
- Nenhuma query Supabase nos relatórios ainda — apenas estrutura e placeholders

