# Performance — refatoração completa (CEO / Gestor / Corretor)

Hoje `/performance` e `/ranking` redirecionam para a Central de Relatórios (`/central-relatorios?secao=...`), e o conteúdo é o `PerformanceHub` (visão, ranking, origem). Os números vêm de `rpc_metricas` (SSOT: leads, visitas agendadas/realizadas/no-show, vendas, VGV assinado). Faltam no SSOT quatro colunas que você pediu: **presença, pipeline ativo, descartes e VGV gerado** (essas existem hoje só na RPC paralela `get_relatorio_equipes`, com regras próprias — é a origem de números divergentes entre telas).

A proposta: uma **página Performance própria e bonita** (visual espelhado no Dashboard do Gerente), com **uma única fonte de dados** para todos os papéis, planilhas de funil e conversão, três rankings e exportação PDF/HTML de qualidade de apresentação.

## O que será entregue

### 1. Fonte única de dados (fim da divergência)
Uma RPC única de funil por corretor no período, devolvendo por linha:

`presença · leads recebidos · pipeline ativo · descartes · visitas totais · visitas realizadas · negócios · VGV gerado · vendas · VGV assinado`

Definições propostas (ficam escritas na tela, em "como calculamos"):
- **Presença** — mesma fonte da página Presença (`get_presenca_agregada`): presenças no período e dias ativos, exibido como `12/20 (60%)`.
- **Leads recebidos** — leads distribuídos ao corretor no período.
- **Pipeline ativo** — fotografia de agora: leads no funil fora de Descarte/Caiu/Ganho e não arquivados.
- **Descartes** — leads movidos para Descarte/Caiu no período.
- **Visitas totais** — visitas criadas no período (agendadas).
- **Visitas realizadas** — visitas com data de realização no período.
- **Negócios** — negócios **abertos no período** (data de criação dentro do período).
- **Gerado** — soma do valor estimado desses negócios abertos no período.
- **VGV assinado** — regra canônica já vigente (data de assinatura BRT, rateio 50/50 de parceria).

Pipeline ativo é a única métrica de fotografia — fica marcada com ícone "snapshot" para ninguém ler como se fosse do período.


### 2. Tela inicial de KPIs (nova home da Performance)
Primeira aba da página: painel visual de destaque, no padrão do Dashboard do Gerente.
- Faixa de KPIs grandes: Presença · Leads · Visitas totais · Visitas realizadas · Negócios abertos · VGV gerado · VGV assinado, cada um com comparativo vs. período anterior (seta e %).
- Funil visual (Leads → Visitas → Visitas realizadas → Negócios → Vendas) com taxas entre etapas.
- Evolução mensal de VGV assinado e visitas (gráfico de linha/área).
- Mini-pódios: top 3 em Leads, Visitas e VGV, com link para a aba Rankings.
- Cartões de atenção (semáforo): corretores sem visita, VGV zerado, descartes acima da faixa.

### 3. Filtro de período
Seletor único no topo, válido para toda a página e para as exportações: **Dia · Semana · Mês · Personalizado** (intervalo de datas), com navegação anterior/próximo e sempre em BRT. O período escolhido vai na URL, para compartilhar o link exato.

### 4. Planilhas (tabelas densas, estilo CRM)

- **Funil por corretor** — uma linha por corretor, colunas acima, agrupável/colapsável por equipe com linha de total da equipe e total geral.
- **Funil por equipe** — versão consolidada.
- **Conversão por equipe e por corretor** — `Leads → Visita` (%), `Visita → Venda` (%), `Leads → Venda` (%), mais ticket médio.
- Ordenação por qualquer coluna, seletor de colunas, e destaque de outliers (verde/âmbar/vermelho por faixa) sem poluir.

### 3. Rankings
Três abas: **Leads**, **Visitas** (totais + realizadas lado a lado) e **VGV assinado**. Pódio nos 3 primeiros + tabela completa com posição, avatar, variação vs. período anterior. Escopo automático: CEO = empresa; gestor = time; corretor = time e empresa.

### 4. Exportação PDF e HTML
Exportação **construída a partir dos dados** (não print de tela): mesmo template para PDF e HTML, com capa (logo, período, escopo, gerado em BRT), sumário executivo, tabelas de funil/conversão e rankings, rodapé paginado. HTML sai como arquivo único auto-contido (abre em qualquer navegador, imprime bem).

### 5. Visões por papel
- **CEO/Diretor** — tudo, filtro por equipe e por corretor, comparativo entre equipes.
- **Gestor** — apenas o próprio time; filtro por corretor individual; mesmas planilhas, conversão, rankings do time e exportação.
- **Corretor** — o próprio funil e conversão, evolução mensal, e os rankings (time e empresa) com sua posição destacada.

## Sugestões de melhoria (incluídas)
- **Comparativo com o período anterior** em cada KPI (delta com seta), já suportado pelo hub atual.
- **Semáforo de saúde do corretor**: sinaliza SLA alto, muitos descartes, zero visitas, VGV zerado — leitura instantânea em reunião.
- **Drill-down**: clicar num número abre a lista dos leads/visitas/negócios que o compõem (padrão que já existe em `PerfDrilldownSheet`).
- **Modo apresentação**: fonte maior e alto contraste para projetar em reunião.

## Detalhes técnicos
- Nova RPC `rpc_perf_funil(p_start, p_end, p_gerente_id, p_user_id)` (SECURITY DEFINER, gate por papel: admin/diretor = tudo, gestor = seu time via `team_members`, corretor = só ele). Reaproveita as views canônicas `v_fato_lead`, `v_fato_visita`, `v_fato_venda`, `v_kpi_presenca`, `pipeline_leads`/`pipeline_historico` e `v_corretor_equipe` (equipe histórica). Uma migration, só DDL.
- Front: `src/pages/Performance.tsx` + `src/components/performance/v3/*` (`FunilTable`, `ConversaoTable`, `RankingsTabs`, `PerfHeader`), hook `useFunilPerformance`. Componentes < 300 linhas; tokens semânticos do design system, sem cor fixa.
- Export: `src/lib/performanceReport.ts` gera o HTML do relatório; PDF via jsPDF + autotable (já no projeto) a partir do mesmo modelo de dados.
- `/performance` e `/ranking` passam a apontar para a nova página; a Central de Relatórios mantém suas seções e deixa de duplicar ranking.

## Ordem de execução
1. **Fase A** — mockup visual (HTML) das três visões para sua aprovação.
2. **Fase B** — RPC única + validação dos números contra a base (conferência corretor a corretor no período do mês).
3. **Fase C** — página e tabelas (CEO), depois gestor e corretor.
4. **Fase D** — rankings.
5. **Fase E** — exportação PDF/HTML e validação ao vivo no preview, ponta a ponta.

## Perguntas antes de começar
1. **Presença** deve vir do checkpoint diário (dias presentes ÷ dias úteis) ou você prefere outra base?
2. **Negócios** na planilha = quantidade em Em Negociação/Contrato agora, ou negócios abertos no período?
