## Auditoria — Central de Performance (`/performance`)

Base lida: `CentralPerformance.tsx`, `PerfVisaoGeral`, `PerfRanking`, `PerfOrigem`, `PerfKpiCard`, `PerfMetaCard`, `PerfEvolucao`, `PerfTopCorretores`, `PerfDrilldownSheet`, `PerfCorretorSheet`, `CorretorProgresso`, `RelatorioCorretor`, camada SSOT (`metricasSSOT.ts`, `useMetricasSSOT`, `useMetasSSOT`, `useMetricasOrigem`, `useMetricasDetalhe`).

### O que já está bom
- Fonte única real: todas as abas consomem `rpc_metricas` / `rpc_metricas_origem` / `rpc_metricas_detalhe` — sem recálculo local de VGV.
- Metas e ritmo reais (`PerfMetaCard`), drill-down por KPI e por corretor, ranking com busca, mobile em cards, CSV do ranking.

### Pontos fracos encontrados

**1. A página não se adapta ao papel (o mais crítico)**
- Todos veem as mesmas 5 abas na mesma ordem, começando em "Visão Geral" da empresa. Um corretor deveria cair em "Meu Progresso"/sua própria performance; CEO/diretor em Visão Geral.
- `gerenteId` só é travado para gestor; não existe travamento por corretor (`filtro.userId` existe na SSOT mas nunca é usado na página).
- Não há filtro/seletor de diretoria — diretor não consegue ver o conjunto das equipes dele.

**2. Período pobre**
- Só navegação mês a mês. Falta trimestre, ano, "últimos 90 dias" e intervalo customizado — CEO/diretor pensam em trimestre/ano.
- Comparativo é só "vs mês anterior" no card de VGV; os demais KPIs não têm comparação.

**3. Visão Geral: diagnóstico raso**
- Só um vazamento (no-show). Faltam: leads sem primeiro contato no SLA e negócios parados em negociação — cada um com o "dono" do problema.
- Funil só tem 2 etapas (lead→visita, visita→venda) e usa multiplicadores artificiais na barra (`conv*4`, `conv*8`), o que distorce a leitura visual.
- Sem visita marcada → realizada e sem etapa de proposta/negociação no funil.

**4. Ranking**
- Ordena, mas não mostra direção da ordenação nem permite inverter; sem indicador de posição vs mês anterior; sem linha de total/média da equipe para comparar.
- Bloco de equipes existe mas não é clicável (não abre detalhe da equipe).

**5. Origem**
- Tem leads/visitas/vendas/VGV, mas **não tem custo**: já existe `marketing_entries` com gasto diário por campanha — falta CPL, custo por visita, custo por venda e ROAS. É a informação que o CEO precisa para cortar campanha.
- Linhas não são clicáveis (sem drill-down para a lista de leads da origem).
- Sem exportação própria (o CSV do header exporta o ranking, não a origem — inconsistente e confuso).

**6. Abas embutidas (Meu Progresso / Relatório 1:1)**
- `CorretorProgresso` renderiza título próprio "Progresso do Dia" e `max-w-4xl` dentro do container, criando página-dentro-de-página e largura destoante.
- Essas duas abas ignoram o filtro de período/equipe do header (o header some, mas o usuário perde contexto ao trocar de aba).

**7. Exportação**
- Só CSV do ranking. Sem PDF e sem exportação sensível à aba ativa.

---

## Plano de melhorias (4 fases, validando cada uma)

### Fase 1 — Papéis e período (fundação)
- Abas e aba inicial por papel: corretor → `Meu Progresso` primeiro + `Minha Performance` (mesma Visão Geral, escopada com `filtro.userId`), sem Ranking global se assim decidido; gestor → Visão Geral da equipe travada; diretor → seletor das equipes sob ele; CEO/admin → tudo.
- Passar `userId` ao `useMetricasSSOT` quando o papel for corretor (a SSOT já suporta).
- Seletor de período: Mês / Trimestre / Ano / 90 dias / Customizado, mantendo BRT.
- Comparativo automático período anterior em todos os KPIs (delta % + seta).

### Fase 2 — Qualidade de dados e diagnóstico
- Bloco "Vazamentos" com 3 itens ranqueados (no-show %, leads sem 1º contato no SLA, negócios parados em negociação > X dias), cada um com corretor/equipe pior colocado e link de ação.
- Funil completo em 5 etapas: leads → visita marcada → visita realizada → negociação → venda, com barras proporcionais reais (sem multiplicador artificial).
- Origem com custo: nova RPC juntando `rpc_metricas_origem` a `marketing_entries` (gasto no período) → CPL, custo/visita, custo/venda e ROAS, com destaque para campanhas acima do CPL alvo.

### Fase 3 — Interação e navegação
- Origem: linha clicável abrindo o drill-down de leads daquela origem/campanha.
- Ranking: seta de ordenação, inverter ordem, linha de média/total, variação de posição vs período anterior, equipe clicável abrindo detalhe da equipe.
- Botão exportar sensível à aba (Ranking → CSV atual; Origem → CSV de origens; Visão Geral → PDF executivo de 1 página com metas, KPIs, funil e top 5).

### Fase 4 — Visual e coerência
- Normalizar `CorretorProgresso` e `RelatorioCorretor` dentro do container (remover header duplicado e `max-w` próprio, herdar padding da página).
- Header pegajoso no scroll com período + filtro; skeletons consistentes; densidade e alvos de toque revisados no mobile (440px).
- Estados vazios explicativos ("sem meta cadastrada" com link para cadastrar meta).

### Notas técnicas
- Todo dado novo continua vindo por RPC na SSOT — nada de cálculo de VGV no frontend.
- Junção com `marketing_entries` respeita BRT e o mesmo recorte de coorte já usado em `rpc_metricas_origem`; a diferença de semântica (custo no período × coorte) será explicitada em tooltip.
- Componentes novos ficam em `src/components/performance/`, cada arquivo < 300 linhas.

Ordem sugerida: Fase 1 → 2 → 3 → 4. Posso começar pela Fase 1, ou inverter se você preferir ver primeiro o custo por campanha (Fase 2).
