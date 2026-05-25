
# Prompt 2 (revisado) — Dashboard Gerente v4

KPIs do topo fixos no MÊS (contexto estratégico permanente). Painéis 2×2 do Prompt 3 terão controles próprios de período.

## Decisão sobre DashboardHeader (escolha justificada)

**Caminho escolhido: reuso com prop opcional `hidePeriodoToggle?: boolean` (default `false`).**

Justificativa:
- Mantém uma única fonte de header — sem duplicação de avatar/saudação/botão Metas.
- Mudança não-quebrante: v3 (que vai virar `/performance`) continua idêntica.
- Quando `/performance` for criada amanhã e o v3 for aposentado, basta apagar a prop — sem refactor de import.
- Custo: 2 linhas no `DashboardHeader.tsx` (prop + condicional ao redor de `<PeriodoToggle>`).

Alternativa rejeitada (criar `V4DashboardHeader.tsx`): duplica 30+ linhas de JSX só para esconder um elemento.

## Arquivos a criar (6)

1. **`src/hooks/useDashboardGerenteV4Kpis.ts`**
   - Assinatura: `useDashboardGerenteV4Kpis(gestorId: string | undefined)` (sem `periodo`).
   - Hardcoded `p_periodo: "mes"` na chamada da RPC.
   - QueryKey: `["dash-v4-kpis", gestorId]`.
   - `staleTime: 5*60_000`, retry 1.
   - Exporta tipos `KpisTopV4`, `AlertaCorretorV4`, `DashboardV4KpisPayload`.

2. **`src/hooks/useDashboardGerenteV4Dia.ts`**
   - Igual ao plano anterior. `(gestorId, visitasRange: "hoje"|"semana")`, `staleTime: 30s`, key `["dash-v4-dia", gestorId, visitasRange]`. Tipos `VisitaV4`, `MiniPipelineFase/Card`, `RoletaCredenciado/Dia`, `DashboardV4DiaPayload`. Criado já agora para o Prompt 3.

3. **`src/components/dashboard-v4/V4VendasHeroCard.tsx`**
   - Card destaque gradient `from-indigo-600 via-indigo-500 to-violet-500`, texto branco, glow decorativo.
   - Mostra: VGV mensal abreviado (R$ X,XM / k), count de vendas, meta, delta % vs mês anterior, barra de progresso branca.

4. **`src/components/dashboard-v4/V4KpisGrid.tsx`**
   - Props: `{ kpis: KpisTopV4 | undefined, isLoading: boolean }` (sem prop `periodo`).
   - Loading: 4 skeletons individuais (cada um com forma de card 2xl, h ~160px) — não bloqueia o resto da página.
   - Ordem dos cards: Leads → Visitas → Negócios ativos → Vendas (hero).
   - Visitas mostra "X realizadas" (linha principal) + "Y agendadas · meta Z" (sublinha) — todos do mês, evita "0/0" da madrugada.
   - Card hero usa label "Este mês" fixo.
   - Grid responsivo: `grid-cols-1 sm:grid-cols-2`, em `≥1100px` vira `1fr 1fr 1fr 1.3fr`.
   - Card de Visitas é wrapper inline custom (reusa visual de `SecondaryMetricCard`); não altera `SecondaryMetricCard`.

5. **`src/components/dashboard-v4/V4QuickActions.tsx`**
   - 3 botões sempre visíveis: Pipeline Negócios → `/negocios`, Pipeline Leads → `/pipeline`, Oferta Ativa → `/oferta-ativa`.
   - 4º (Performance → `/performance`) gated por `import.meta.env.VITE_PERFORMANCE_ENABLED === 'true'` (default false).
   - Comentário no topo do arquivo explicando como ativar.
   - Grid: 1/3 colunas (3 botões) ou 2/4 (com Performance).

6. **`src/components/dashboard-v4/DashboardV4Page.tsx`**
   - Sem estado de `periodo`. Sem `sessionStorage`. Sem `setPeriodo`.
   - Query do perfil para o header.
   - Consome `useDashboardGerenteV4Kpis(user?.id)` — passa `isLoading` para o grid.
   - Renderiza: `DashboardHeader` (com `hidePeriodoToggle`) → `V4KpisGrid` (com skeleton individual) → `V4QuickActions` → placeholder dos painéis (Prompt 3) → `EditarMetasModal` controlado pelo botão Metas.
   - Erro: bloco vermelho discreto acima do grid, sem retry button, sem telemetria. KPIs e Quick Actions abaixo continuam interativas se possível.

## Arquivos a alterar (2)

7. **`src/pages/GerenteDashboard.tsx`** — wrapper enxuto: guard de role + spinner roleLoading + `<DashboardV4Page />`. Toda lógica de período/sessionStorage/RPC sai daqui.

8. **`src/components/gerente/dashboard-v3/DashboardHeader.tsx`** — adicionar prop opcional `hidePeriodoToggle?: boolean` (default `false`); envolver `<PeriodoToggle />` em `{!hidePeriodoToggle && (...)}`. **Nenhuma mudança visual no v3** (default mantém comportamento atual).

## Não tocar

- `useDashboardGerenteV3.ts`, demais arquivos de `dashboard-v3/*`
- RPCs `get_dashboard_gerente`, `get_dashboard_gerente_v4_kpis`, `get_dashboard_gerente_v4_dia`
- `pageRegistry.ts`, Tabs antigas (TabAgora etc.), Modo Time, customClient, infra, worker, sw.js

## Validação após build

1. `/gerente/dashboard` (Gabrielle) carrega sem white-screen.
2. Header: avatar + "Boa noite, Gabrielle" + botão **Metas** — **sem** toggle Hoje/Semana/Mês.
3. KPIs do mês:
   - Leads: 339 / 400
   - Visitas: "X realizadas" + "Y agendadas · meta Z" (valores reais do mês)
   - Negócios ativos: 78 / 90
   - Vendas: VGV mensal com gradient indigo, count, delta vs mês anterior
4. 3 quick actions clicáveis (Performance ausente).
5. Botão Metas abre `EditarMetasModal` com `mes_key` = mês corrente.
6. Durante loading, aparecem 4 skeletons no grid; quick actions já clicáveis.
7. Sem erros TS, sem warnings de import não usado, console limpo.
8. `/gerente/dashboard` em rota legada (v3) — **se ainda for usada em outro lugar** — continua renderizando PeriodoToggle (validar que `dashboard-v3/DashboardHeader` ainda mostra toggle quando prop não é passada).

## Próximos passos (não executar agora)

- **Prompt 3:** 4 painéis (Visitas / Mini-pipeline / Alertas / Roleta) consumindo `useDashboardGerenteV4Dia` + `alertas_corretores`.
- **Prompt 4:** Deletar tabs órfãs do v2.

Aguardando OK explícito para alternar para build mode e persistir os 8 arquivos.
