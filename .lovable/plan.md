

## Plano: Reimplementar componentes da Central de Relatórios com estilos exatos

Os arquivos `pageRegistry.ts` e `Sidebar.tsx` ja possuem as entradas corretas — nao precisam de alteracao.

### Arquivos a reescrever (4)

**1. `src/pages/ReportCenter.tsx`**
- Layout flex col, height 100vh, background #f0f0f5
- useSearchParams para tab/periodo/equipe/corretor/segmento
- useUserRole() para redirect de corretor para /pipeline-leads
- Renderiza ReportTabs + ReportFilters + ReportPlaceholder (com scroll na area de conteudo)

**2. `src/components/relatorios/ReportTabs.tsx`**
- Reescrever com inline styles exatos: height 48px, padding 0 20px, font-size 13px
- Tab ativa: color #4F46E5, border-bottom 2px solid, font-weight 500
- Tab mega: sempre color #4F46E5
- Scrollbar oculta via CSS inline + className

**3. `src/components/relatorios/ReportFilters.tsx`**
- Chips de periodo com border 0.5px solid #d1d5db, border-radius 20px, padding 5px 14px
- Chip ativo: bg #EEF2FF, color #4F46E5, border-color #C7D2FE
- Chip "Personalizado" ativo mostra dois inputs date
- Selects estilizados como chips (border-radius 20px) — sem queries Supabase reais, apenas placeholder options
- Botao "Exportar PDF" com bg #4F46E5, icone Download
- Botao "Link" copia URL e mostra toast
- Props: filters object + onFiltersChange + userRole string
- Select Equipe visivel apenas se userRole === "admin"

**4. `src/components/relatorios/ReportPlaceholder.tsx`**
- Prop renomeada para `tabName`
- Icone Construction, texto "Relatorio {tabName}", subtitulo "Em construcao — disponivel em breve"
- Centralizado vertical/horizontal com flex

### Nao alterar
- pageRegistry.ts (ja tem report-center)
- Sidebar.tsx (ja tem Central Relatorios)
- Nenhum outro arquivo

