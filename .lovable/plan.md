## Validação da Fase A (feita agora, ao vivo)

| Aba | Resultado |
|---|---|
| Visão Geral | Meta do mês R$ 4,7M de R$ 8,3M (57%), ritmo esperado 91%, "Abaixo do ritmo -37%", projeção R$ 5,2M. KPIs com meta real: Vendas 20% de 46, Visitas 88% de 190, Leads 101% de 1.300. Vazamento: 122 no-shows em 187 marcadas (42%). |
| Ranking | 31 corretores com equipe, parceria 50/50, VGV correto (Adriana R$ 1,4M topo). |
| Meu Progresso | Carrega sem erro. |
| Relatório 1:1 | Carrega sem erro (estado "sem rascunhos"). |

Sem erros de runtime. Só warnings antigos de `forwardRef` no App (pré-existentes, fora do escopo).

Observações visuais: o card "VGV assinado" quebra o valor em duas linhas; o Relatório 1:1 tem header próprio duplicando o da central; a tabela do Ranking rola na horizontal no celular.

---

## Fase B — de relatório para instrumento de decisão

### B1. Funil por Origem e Campanha (bloco novo)
Novo bloco na Visão Geral: tabela/heatmap com Leads → Visitas realizadas → Vendas → VGV, agrupado por **origem** e, ao expandir, por **campanha**. Colunas de conversão (%) e CPL quando houver custo. Objetivo: ver na Performance o que hoje só existe em Dados Anúncios, mas medido pelo SSOT (mesma verdade de VGV).

Backend: nova RPC `rpc_metricas_origem(p_start, p_end, p_gerente_id)` agregando `v_fato_lead` + `v_fato_visita` + `v_fato_venda` por `origem`/`campanha`. Sem tabelas novas.

### B2. Drill-down nos KPIs e no Ranking
- Clicar num KPI abre painel lateral com a lista que compõe o número (vendas do mês, visitas realizadas, leads recebidos), com corretor, empreendimento e data.
- Clicar numa linha do Ranking abre o perfil do corretor no período: KPIs dele, funil, últimas vendas e visitas, no-show.

### B3. Bloco de vazamentos ampliado
Hoje só no-show. Passa a mostrar 3 vazamentos ranqueados com o dono do problema: no-show %, leads sem primeiro contato no SLA, e negócios parados em negociação há mais de X dias — cada um com o corretor/equipe pior colocado e link para agir.

### B4. Leitura e mobile
- Ranking vira cards empilhados abaixo de 768px (sem scroll horizontal).
- Busca por corretor + coluna de conversão (visita→venda) no Ranking.
- Ajuste do card de VGV para não quebrar linha.
- Header interno do Relatório 1:1 removido/alinhado ao padrão da central.

### Detalhes técnicos
- Nova RPC `rpc_metricas_origem` (SQL, `security invoker`, mesmas regras de rateio 50/50 e BRT do `rpc_metricas`) + `src/hooks/useMetricasOrigemSSOT.ts`.
- Novos componentes em `src/components/performance/`: `PerfFunilOrigem.tsx`, `PerfDrilldownSheet.tsx`, `PerfVazamentos.tsx`, `PerfRankingCards.tsx`.
- `PerfRanking.tsx` e `PerfVisaoGeral.tsx` recebem handlers de drill-down; nenhum cálculo novo no frontend — tudo vem do SSOT.
- 1 migration apenas (criação da RPC), respeitando o limite diário e a janela BRT.

### Ordem de execução sugerida
B4 (rápido, ganho imediato de leitura) → B1 (maior valor de decisão) → B3 → B2.

Confirma a ordem, ou prefere começar direto pelo funil por origem (B1)?
