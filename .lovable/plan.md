## Central de Relatórios — reconstrução completa (visual + dados + funções)

### Diagnóstico do estado atual
A rota `/central-relatorios` → `CentralRelatoriosV2` hoje:
- **Só a seção "Geral" funciona.** As 6 abas do menu lateral (Pipeline de Leads, Oferta Ativa, Visitas, Negócios, Vendas, Ranking) caem em `EmptyStateView` → tela "Em construção · Fase 0.5". O usuário clica e não vê nada.
- Os componentes de seção (`SectionVendas`, `SectionVisitas`, etc.) **já existem e funcionam**, mas só são montados empilhados dentro do "Geral" — não nas próprias abas.
- **Bug de dados real:** `SectionVendas` lê `r.vendas` na tabela "Top empreendimentos", mas a RPC `get_relatorio_vendas` devolve o campo `count`. Resultado: coluna "Vendas" sempre "—".
- **Ranking quebrado:** o `RankingTeaser` leva para `?secao=ranking`, que mostra "Em construção". A RPC `get_ranking_central(p_gestor_id, p_start, p_end)` já existe no banco e não é consumida.
- Export PDF só cobre "Geral"; nas demais abas dá toast "indisponível".
- Visual funcional mas plano: KPIs em texto, sem gráficos (apesar de `recharts` instalado e das RPCs já devolverem séries `por_dia`).

A camada de dados (`_kpi_team_window_core` + 5 RPCs `SECURITY DEFINER`) é sólida, BRT-correta, com janela atual vs. anterior e split de parceria. **Mantemos o backend; o problema é frontend + 2 ajustes pontuais de mapeamento.**

### Objetivo
Transformar a Central numa central de inteligência completa para o gestor: cada aba vira uma visão rica e funcional (KPIs + gráfico + tabela), dados validados campo a campo, ranking real, visual moderno e exportação ampla — sem quebrar nada.

---

### Fase 1 — Ativar todas as abas (fim do "Em construção")
Em `CentralRelatoriosV2.tsx`, substituir o roteamento `geral ? GeralView : EmptyStateView` por um switch que renderiza a visão real de cada seção, reusando os `Section*` existentes e o hook `useRelatoriosCentral`:
- `geral` → `GeralView` (resumo executivo, hoje)
- `pipeline-leads` → `SectionPipelineLeads`
- `oferta-ativa` → `SectionOA`
- `visitas` → `SectionVisitas`
- `negocios` → `SectionNegocios`
- `vendas` → `SectionVendas`
- `ranking` → novo `SectionRanking`

Cada aba carrega só a(s) query(ies) que precisa. `EmptyStateView` é removido do fluxo.

### Fase 2 — Corrigir e validar cada dado
- **Vendas:** corrigir o mapeamento da coluna para `count` (com fallback `vendas`). Validar `vendas.vgv / count / ticket_medio / delta_pct` e `extras.comissao_estimada`.
- **Auditoria campo a campo:** para cada seção, conferir que toda chave lida via `safeGet` existe no JSON da RPC correspondente (já mapeei as chaves de Leads, OA, Visitas, Negócios, Vendas). Onde houver divergência, alinhar o front à RPC.
- **Validação com dados reais:** após o build, rodar cada RPC autenticado como gestor/admin via Playwright na própria página e cruzar os números com consultas diretas (`negocios`, `visitas`, `pipeline_leads`) para o mês corrente. Nada de número fantasma.

### Fase 3 — Seção Ranking real
Novo `SectionRanking` + entrada no `useRelatoriosCentral` consumindo `get_ranking_central`. Tabela ordenável por VGV / vendas / visitas / leads, com pódio (top 3 destacado) e medalhas. Substitui o teaser que hoje leva a uma tela vazia (mantém o teaser no "Geral" como atalho).

### Fase 4 — Modernização visual (modo gestor premium)
Mantendo os tokens semânticos do design system (sem cores hardcoded):
- **KPI cards** com ícone, valor grande, delta colorido (▲ verde / ▼ vermelho) vs. período anterior e sparkline quando houver série.
- **Gráficos `recharts`** alimentados pelos `extras.por_dia` já existentes: área/linha de VGV e vendas por dia (Vendas), barras de visitas por status, funil de leads→visita→negócio→venda no "Geral".
- **Header e filtros** refinados: período (hoje/semana/mês/trimestre/custom) + seletor de equipe (admin) numa barra sticky compacta e responsiva.
- **Mobile 100% funcional:** abas viram menu deslizante (já há `Sheet`), cards em coluna, gráficos responsivos, nada cortado.
- Skeletons de carregamento e `SectionError` por seção (isolamento de falha — uma aba que erra não derruba as outras).

### Fase 5 — Exportação ampliada
Estender `centralPdf` para exportar a seção ativa (não só "Geral"), capturando KPIs + gráfico + tabela da view atual.

### Fase 6 — Validação final
- Build limpo + checagem de tipos (sem `as any` novo).
- Playwright autenticado: percorrer as 7 abas em desktop e mobile, screenshot de cada uma, confirmar dados, gráficos e ausência de erros no console.
- Conferência cruzada dos KPIs principais (VGV, vendas, visitas realizadas, leads) contra o banco.

---

### Detalhes técnicos
- **Arquivos novos:** `src/components/central-v2/sections/SectionRanking.tsx`; possíveis `shared/KpiCard.tsx` e `shared/MiniChart.tsx` (wrappers `recharts`).
- **Arquivos alterados:** `CentralRelatoriosV2.tsx` (router de seções), `useRelatoriosCentral.ts` (+query ranking), `GeralView.tsx` (gráficos/funil), `SectionVendas.tsx` (fix `count`) e demais `Section*` (KpiCard + gráfico), `lib/centralPdf.ts` (export por seção).
- **Backend:** nenhuma migration nova — todas as RPCs já existem (`get_relatorio_*`, `get_ranking_central`). Só leitura/validação.
- **Sem mexer** em tabelas, RLS, edge functions ou no cliente Supabase auto-gerado.

### Fora de escopo (confirmar se quiser incluir)
- Novas métricas que exijam RPC nova (ex.: tempo médio de resposta por lead).
- Drill-down clicável de KPI → lista de registros.
</content>
<summary>Plano para reconstruir a Central de Relatórios: ativar as 6 abas hoje "em construção", corrigir bugs de mapeamento de dados, adicionar ranking real e gráficos recharts, modernizar o visual (KPI cards, deltas, mobile), ampliar export PDF e validar cada dado contra o banco. Backend já pronto — sem migrations.</summary>
</invoke>
