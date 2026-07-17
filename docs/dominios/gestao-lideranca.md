# Domínio 9 — Gestão & Liderança

## 1. Propósito
Painéis, forecast, ranking e metas para gerentes, diretores e CEO acompanharem performance individual/equipe/empresa em tempo real.

## 2. Tabelas
- `team_members` (8 col, 4 policies) — **fonte única** da relação gerente↔corretor (mem)
- `diretoria_equipes` — relação diretor↔gerente
- `corretor_metas_mensais`, `melnick_metas_diarias`
- `empresa_metas_mensais`, `ceo_metas_mensais`
- `checkpoints`, `checkpoint_diario`, `checkpoint_lines` — checkpoint operacional
- `corretor_daily_goals`, `corretor_reports`
- `manager_checklist`
- `coaching_sessions`, `one_on_one_reports`, `relatorios_1_1`
- `executive_reports`
- `funnel_entries`, `marketing_entries`, `pdn_entries` (40 col — PDN do Gestor)
- `corretor_motivations`, `corretor_progresso` (via view)
- `feriados` (dinâmico, força "All Day" — mem)

## 3. Fluxo
```
Diariamente (BRT -03:00):
  cron-health-monitor
  edge-health-alert
  checkpoint_diario auto-gera baseado em atividades
  
Manualmente:
  Gerente preenche PDN (/pdn) → pdn_entries
  1:1 mensal → auto-one-on-one → one_on_one_reports
  
Dashboards (leitura):
  useDashboardGerenteV3 / V4 (Dia + Kpis)
  useCeoData, useKPIs
  useForecast (com corretor_metas_mensais + pipeline)
  useRelatoriosCentral / useRelatorioEquipes
```

## 4. Componentes/hooks
- `src/pages/GerenteDashboard.tsx`, `CorretorDashboard.tsx`, `HomeDashboard.tsx`
- `src/pages/BackofficeCentral.tsx`, `BackofficeDashboard.tsx`
- `src/pages/CentralRelatoriosV2.tsx`, `ReportCenter.tsx`, `RelatorioOrigemPerformancePage.tsx`
- `src/pages/EscalaDiaria.tsx`, `MeuTime.tsx`, `Conquistas.tsx`, `RankingEquipe.tsx`
- `src/components/gerente/dashboard-v3/*`, `dashboard-v4/*`
- `src/components/ceo/*`, `src/components/central/*`, `src/components/central-v2/*`
- `src/components/forecast/*`, `src/components/checkpoint/*`
- `src/components/pdn/*`
- Hooks: `useDashboardGerenteV3/V4Dia/V4Kpis`, `useCeoData`, `useKPIs`, `useForecast`, `useRelatorioEquipes`, `useRelatoriosCentral`, `useTimeAgregado`, `useTimeAlertas`

## 5. Edge Functions
| Fn | Faz |
|---|---|
| `generate-corretor-report` | Relatório individual |
| `generate-monthly-report` | Mensal |
| `auto-one-on-one` | Gera 1:1 automático |
| `funnel-coach` | Coach de funil |
| `checkpoint-coach` | Coach checkpoint |
| `ceo-advisor`, `homi-ceo` | Assistente CEO |
| `parse-marketing-report` | Extrai KPIs de PDF |
| `cron-health-monitor` / `edge-health-alert` | Observabilidade |

## 6. Regras não óbvias
- `team_members` é **exclusivo** para hierarquia (mem://arquitetura/database/team-structure-schema).
- **Manager Presence Logic**: se não tem checkpoint manual, usa `isOnline` como fallback (mem).
- **BRT globalmente** (mem://arquitetura/reporting/brt-time-centralization) — usar `formatBRT()` de `@/lib/brtTime`, nunca `format(new Date(x), 'HH:mm')`.
- **PostgREST 1000-row cap** — paginate via .range() em queries de analytics (mem).
- **CRM Quality Score** — fórmula proprietária (mem://features/reporting/management-performance-reports-v2).
- **Modo Foco**: cache HOMI 4h em sessão, FOCUS_STAGNANT_DAYS=14, atrasada = data+hora BRT (mem).
- **1:1 mirroring** VGV/pipeline (mem://features/reporting/one-on-one-reports-v4).

## 7. Decisões
- CEO Dashboard: 7 colunas, alturas não constrangidas (mem://features/ceo/dashboard-kpi-metrics-visuals).
- Task Central: default aba "Todas", limit 1000 (mem).
- Limpeza menu CEO (2026-06): itens removidos, Admin migrado, "Rankings" → "Performance" com aba Visão Geral.
- Manager Dashboard v2: 4 tabs de densidade.

## 8. Dependências
Consome: TUDO. Produz: relatórios PDF/CSV.

## 9. Perguntas
1. `melnick_metas_diarias`/`melnick_campaign_analytics` — Melnick é cliente/parceiro específico? Isolado ou padrão para outros?
2. `checkpoints` vs `checkpoint_diario` vs `checkpoint_lines` — três tabelas de checkpoint.
3. `relatorios_1_1` vs `one_on_one_reports` — 2 tabelas para 1:1.
4. `manager_checklist` — uso ativo?
5. `corretor_motivations` — quem preenche?
6. `pdn_entries` (40 col) — schema pesado. Todas colunas em uso?
7. `funnel_entries` (21 col) vs `marketing_entries` (21 col) — mesmo modelo, domínios diferentes?
