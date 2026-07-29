
# Auditoria da Central de Performance — visão de diretor

Validei ao vivo em `/performance` (logado como Lucas · Admin/CEO) e li o código das 4 abas + o backend SSOT. Abaixo o diagnóstico bloco a bloco e o que falta para virar "produto de ponta".

## O que está sólido
- Números vêm de fonte única (`rpc_metricas` → `v_fato_venda/visita/lead`), com rateio 50/50 e equipe histórica de desligados.
- Visão Geral carrega em ~2s: VGV R$ 4,7M (−17,0%), 9 vendas (ticket R$ 527k), 167 visitas (no-show 42%), 1.307 leads / 31 corretores, evolução 6 meses e funil 12,8% / 5,4%.
- Sem erros de runtime (só warnings de ref pré-existentes do App).

## Problemas encontrados (aba por aba)

**Visão Geral**
1. As barrinhas dos 4 KPIs são decorativas e enganosas: usam fórmulas arbitrárias (`vendas × 10`, `conversão × 5`). Um card de diretoria não pode ter gauge sem denominador real.
2. Não existe **meta**. O CRM já tem `ceo_metas_mensais` (10 registros, jul/26), `empresa_metas_mensais` e `corretor_metas_mensais` — nada disso aparece. Sem meta não há leitura de "estamos bem ou mal".
3. Nenhum KPI é clicável: não dá para saber quem são as 9 vendas, as 167 visitas ou os 70 no-shows.
4. Falta a leitura de **negócio**: no-show 42% é o maior vazamento do mês e está escondido como legenda cinza.
5. O card "Top Corretores" fica com ~500px de vazio embaixo (a coluna estica com o gráfico).
6. Sem corte por **origem/campanha/empreendimento**, embora `v_fato_lead` já traga origem, campanha, conjunto, anúncio e empreendimento canônico.

**Ranking**
7. Tabela sem busca, sem posição vs. mês anterior, sem taxas de conversão por linha (lead→visita, visita→venda) e sem meta individual — é um extrato, não um ranking de gestão.
8. Nenhuma linha é clicável (sem drill-down por corretor).
9. 7 colunas fixas quebram no mobile (você está em 440px de viewport) — só rola horizontal.
10. O card "Equipes" mostra só VGV; falta produtividade por cabeça (VGV/corretor, visitas/corretor).

**Meu Progresso**
11. É a tela de gamificação do corretor colada dentro da central: para Admin/CEO aparece "0 pts · Iniciante", missões 0/30 e conquistas todas bloqueadas — ruído puro para gestão.
12. Ignora o filtro de período do header (é sempre "hoje") e traz título próprio ("Progresso do Dia"), quebrando a hierarquia visual.

**Relatório 1:1**
13. Header duplicado ("Relatório 1:1 por Corretor") + abas dentro de abas — três níveis de navegação na mesma tela.
14. **Risco de divergência de dados**: as métricas do 1:1 vêm de `v_checkpoint_lines_canonical` (preenchimento manual do checkpoint), não do SSOT. O mesmo corretor pode ter VGV diferente na aba Ranking e no relatório 1:1 — exatamente o problema que a fonte única veio matar.
15. O filtro de período/equipe do header some nessa aba, sem explicação.

## Plano proposto (4 fases, uma por vez, com validação no preview)

**Fase A — Verdade e confiança (maior impacto)**
- Trocar as barras decorativas dos KPIs por **progresso real contra meta** do mês (meta empresa/equipe/corretor conforme o filtro ativo), com ritmo esperado do mês ("no pace"): pace = dias úteis decorridos / dias úteis do mês.
- Card de meta no topo: Realizado x Meta x Faltam x Projeção de fechamento.
- Alinhar o Relatório 1:1 ao SSOT: métricas reais (visitas, vendas, VGV, leads) vindas de `rpc_metricas`, mantendo do checkpoint só o que não existe no SSOT (ligações, presença, propostas), com rótulo de origem em cada linha.

**Fase B — Drill-down e diagnóstico**
- KPIs e linhas do ranking clicáveis → painel lateral com a lista real (vendas, visitas, no-shows, leads) e link para o lead/negócio.
- Bloco "Onde estamos perdendo": no-show, leads sem visita, tempo médio lead→visita e lead→venda, com o corte por equipe.
- Funil de conversão por **origem/campanha/empreendimento** (dados já existem em `v_fato_lead`), respondendo "qual campanha vira venda".

**Fase C — Ranking de gestão**
- Colunas de conversão por linha, delta de posição vs. mês anterior, % da meta, busca por nome, e ordenação asc/desc.
- Card Equipes com VGV/corretor e visitas/corretor.
- Versão mobile em cards (sem scroll horizontal).

**Fase D — Coerência das abas**
- "Meu Progresso" passa a ser sensível ao papel: corretor vê gamificação; gestor/CEO vê o próprio painel de time (ou a aba fica oculta para admin).
- Remover headers internos duplicados de Progresso e 1:1; período e equipe passam a valer nas 4 abas.
- Export: CSV já existe; incluir PDF executivo do mês (mesma identidade do relatório 1:1).

## Notas técnicas
- Nada aqui exige migration nova para as Fases A–C, exceto se você quiser meta por equipe (hoje há meta por empresa, por CEO e por corretor; meta por equipe teria de ser derivada da soma dos corretores ou de uma tabela nova).
- Todo cálculo continua passando por `metricasSSOT.ts` / `rpc_metricas`; nenhum componente vai consultar `negocios`/`visitas` direto.
- Arquivos afetados: `src/components/performance/*`, `src/pages/CentralPerformance.tsx`, `src/hooks/useMetricasSSOT.ts` (+ novo hook de metas), `src/pages/RelatorioCorretor.tsx`.

Sugiro começar pela **Fase A** (meta + pace + 1:1 no SSOT), que é onde a página deixa de ser "relatório" e vira instrumento de decisão.
