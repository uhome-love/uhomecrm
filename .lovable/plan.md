

## Plan

Implement Leads and Conversão report tabs by extracting shared utilities and wiring two new report components.

### Files to create

**1. `src/components/relatorios/reportUtils.ts`** — already exists per current-code (matches spec). No change needed beyond verification.

**2. `src/components/relatorios/RelatorioLeads.tsx`**
- Fetch `pipeline_leads` filtered by date range + equipe/corretor/segmento
- Resolve corretor/gestor names via `profiles`
- Fetch first contact activity (`pipeline_atividades` tipo IN ligacao/whatsapp) per lead for "Tempo Médio 1º Contato" KPI
- Fetch MAX(created_at) per lead for "Última atividade" column
- 4 KPI cards (Total, Ativos, Sem Contato, Tempo Médio 1º Contato) with prev-period comparison
- Recharts BarChart grouping leads by created_at date (#6366f1)
- Sortable table with badges per etapa (color map per spec), search by nome/telefone, pagination 20/page
- Loading shimmer + empty state (Users icon)

**3. `src/components/relatorios/RelatorioConversao.tsx`**
- Two independent funnels (no date filter, only equipe/corretor/segmento)
- Funil de Leads: 9 etapas with count, %, tempo médio, color-coded bars sized relative to max
- Funil de Negócios: 6 fases from `negocios.fase` with PT label mapping
- 3 KPI cards (Lead→Visita, Negócio→Venda, Lead→Venda overall)
- Bottlenecks table: top 3 etapas by count (excluding Descarte)
- Loading skeletons + empty state (TrendingUp icon)

### Files to modify

**4. `src/components/relatorios/RelatorioVendas.tsx`** — replace local utility definitions with imports from `./reportUtils`. Need to view first to identify exact ranges.

**5. `src/pages/ReportCenter.tsx`** — already wires `RelatorioLeads` and `RelatorioConversao` per current-code. No change needed.

### Verification steps

- View `RelatorioVendas.tsx` to confirm which local definitions exist and how segmento filter works (to mirror in RelatorioLeads)
- Confirm `reportUtils.ts` matches spec exactly (it does per current-code)
- Confirm `ReportCenter.tsx` wiring (already correct)
- Inspect `pipeline_leads` and `negocios` schemas to validate column names (`etapa`, `fase`, `corretor_id`, `data_assinatura`)
- Inspect `pipeline_atividades` for `tipo` and `lead_id` columns
- Inspect `profiles` for `gestor_id` column

### Constraints honored

- No new dependencies (recharts + lucide-react already present)
- No changes outside the 5 listed files
- No `any` types
- All numbers rounded before render
- Reuse existing `@/integrations/supabase/client`

