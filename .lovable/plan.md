## Central de Relatórios — redesign extraordinário (visual + dados + análise)

### Diagnóstico do estado atual
A rota `/central-relatorios` → `CentralRelatoriosV2` já é funcional (7 abas ativas, RPCs em paralelo, export PDF), mas o visual é "plano": cards brancos genéricos (`central-card` = só borda + sombra leve), KPIs em texto simples sem sparkline, gráficos isolados sem contexto, header pobre (só título + botão PDF) e sidebar de navegação básica. Falta a linguagem premium que aplicamos no **Pipeline** (command bar, segmented control, densidade) e na **Roleta** (grupos de navegação em pills full-width, status bar, hierarquia visual). Os dados existem e estão corretos — o problema é apresentação e profundidade analítica.

### Objetivo
Elevar a Central ao mesmo nível de produto SaaS premium do Pipeline/Roleta: header de comando, navegação por grupos elegante, KPI cards com microvisual (delta colorido + sparkline + ícone), gráficos com contexto comparativo, e análises mais ricas e úteis para gestão em cada relatório — tudo responsivo (mobile 100%), sem quebrar nada e validando cada número contra o banco.

---

### Fase 1 — Linguagem visual / design system da Central
- Criar tokens/classes utilitárias próprias da Central no `index.css` (reaproveitando os tokens semânticos existentes — nada hardcoded): variantes de card (`central-card`, `central-card-kpi`, `central-card-accent`), gradientes sutis de destaque, anel de foco no primário (mesmo idioma da Roleta `ring-primary/40`).
- Padronizar espaçamentos, raios (14px) e tipografia display já usados, mas aplicar hierarquia consistente em todas as seções.

### Fase 2 — Header "Command bar" (substitui CentralHeader atual)
- Linha 1: identidade ("Central de Relatórios" + seção ativa em breadcrumb), seletor de **período** (pills Hoje/Semana/Mês/Trimestre/Personalizado) movido pra cá, seletor de **equipe** (admin), e ações primárias (Exportar PDF, atualizar).
- Sticky, com `backdrop-blur`, contagem do range ativo ("01–29 jun · vs. mês anterior") para dar contexto comparativo imediato.
- Mescla o conteúdo de `CentralFilters` no header, eliminando o card de filtros solto e ganhando espaço vertical.

### Fase 3 — Navegação por grupos (estilo Roleta)
- Substituir a sidebar simples por **navegação em pills agrupadas** (full-width no topo do conteúdo no desktop; `Sheet` deslizante no mobile), agrupando: **Visão Geral** · **Comercial** (Pipeline de Leads, Oferta Ativa, Visitas) · **Resultado** (Negócios, Vendas) · **Equipe** (Ranking). Indicador ativo claro, ícones, contador quando fizer sentido.

### Fase 4 — KPI cards premium (shared/KpiRow + ExecutiveSummary)
- Redesenhar `KpiRow` e `ExecutiveSummary`: cada card com ícone temático, valor grande (display), **delta vs. período anterior** (▲ verde / ▼ vermelho, já existe no backend via `delta_pct`), e **sparkline** miniatura quando houver série (`extras.por_dia`).
- `ExecutiveSummary` vira um "hero" de KPIs do período (VGV, Visitas realizadas, Negócios assinados, Taxa de conversão) com visual de destaque.

### Fase 5 — Gráficos e análises mais ricas por relatório
Para cada seção, além de KPIs, adicionar a visão analítica mais útil pra gestão (todas com dados já devolvidos pelas RPCs; onde faltar série, derivar do JSON existente — sem nova migration):
- **Geral:** funil Leads → Visitas → Negócios → Vendas (conversão entre etapas) + tendência de VGV.
- **Pipeline de Leads:** distribuição por estágio/segmento (barras), entrada vs. saída, sparkline por dia.
- **Oferta Ativa:** tentativas vs. aproveitamento por lista, taxa de conversão, ranking de listas.
- **Visitas:** área por dia + barras por dia da semana, taxa de comparecimento com destaque, top empreendimentos.
- **Negócios:** tempo médio em fase, distribuição por estágio, assinados cruzados de Vendas.
- **Vendas:** tendência de VGV (área), ticket médio, comissão estimada, top empreendimentos com barra proporcional.
- **Ranking:** manter pódio + tabela ordenável (já existe), refinando o visual (medalhas, barras de progresso por métrica).
- Melhorar `MiniTable` com barras inline proporcionais e melhor densidade.

### Fase 6 — Estados, loading e robustez
- Skeletons consistentes com o novo visual em todas as seções.
- `SectionError` isolado por seção (uma aba que falha não derruba as outras) — já existe, padronizar.
- Empty states elegantes (ilustração/ícone + texto), não só "sem dados".

### Fase 7 — Validação de dados (sem números fantasma)
- Auditoria campo a campo: confirmar que toda chave lida via `safeGet` existe no JSON de cada RPC (`get_relatorio_*`, `get_ranking_central`).
- Validação com dados reais via Playwright autenticado como gestor/admin: percorrer as 7 abas, cruzar VGV / vendas / visitas / leads com consultas diretas ao banco (`negocios`, `visitas`, `pipeline_leads`) para o mês corrente.

### Fase 8 — Verificação final
- Build limpo + typecheck (sem `as any` novo).
- Playwright: screenshots das 7 abas em desktop (1280px) e mobile (440px), confirmar visual, gráficos e ausência de erros no console.
- Conferência cruzada dos KPIs principais contra o banco.

---

### Detalhes técnicos
- **Arquivos alterados (frontend apenas):** `CentralHeader.tsx` (command bar + filtros), `CentralFilters.tsx` (mesclado/simplificado), `CentralSidebar.tsx` → navegação por grupos, `shared/KpiRow.tsx` (+sparkline/ícone), `shared/MiniChart.tsx` (novos tipos: funil/linha comparativa), `shared/MiniTable.tsx` (barras inline), `ExecutiveSummary.tsx`, todas as `Section*.tsx`, `GeralView.tsx`, `SectionRouterView.tsx`, e `index.css` (tokens/classes da Central).
- **Backend:** nenhuma migration, nenhuma alteração de RPC, RLS, tabela, edge function ou cliente Supabase — só leitura/validação das RPCs já existentes (`get_relatorio_pipeline_leads/oferta_ativa/visitas/negocios/vendas`, `get_ranking_central`).
- **Sem quebrar:** mantém rotas, query keys, contrato dos hooks (`useRelatoriosCentral`) e o fluxo de export PDF (`centralPdf.ts`) — apenas adaptando os `targetId` se necessário.

### Fora de escopo (confirmar se quiser incluir)
- Novas métricas que exijam RPC nova (ex.: tempo médio de 1ª resposta por lead, drill-down clicável KPI → lista de registros).
- Geração de direções visuais com previews antes de implementar (posso rodar isso primeiro se quiser escolher entre 3 estilos para o header/cards).
