# Auditoria — VGV Assinado no Dashboard CEO

## O que foi verificado no banco (leitura, sem alterações)

Vendas assinadas em julho/2026 (`negocios`, fase `ganho`, status `ativo`, `data_assinatura` em julho):
**9 vendas · R$ 4.740.900**

A função oficial `get_kpis_por_periodo('2026-07-01','2026-07-31')` retorna exatamente `vgv_assinado = 4.740.900`. Ou seja, o dado existe e o cálculo do mês está certo.

Para 30/07 isoladamente, retorna 0 — e nenhuma venda tem `data_assinatura` em 30 ou 31/07.

## Por que a tela mostra R$ 0

O card "VGV Assinado" é escopado pelo período selecionado no topo do dashboard. Na tela enviada o período em uso não contém nenhuma assinatura (dia atual), então R$ 0 está tecnicamente correto — mas a tela não deixa isso claro e passa a impressão de que o CRM "perdeu" as vendas.

Agrava a confusão: no mesmo bloco, "Total de Negócios (33)", "Em Negociação (29)" e "Contrato (4)" **não** respeitam o período — são o retrato atual do pipeline (confere com o banco: 29 + 4 ativos). Só "Ganho" é filtrado por período. Card de período misturado com card de snapshot, lado a lado.

## Problemas reais encontrados (esses são bugs)

1. **Ticket médio errado.** O KPI `vendas` conta negócios *criados* no período que hoje estão em `ganho` (23 em julho), não as vendas *assinadas* no período (9). O ticket médio divide R$ 4,74M por 23.
2. **`conta_venda` sem filtro de status.** Na view `v_kpi_negocios`, qualquer `fase = 'ganho'` conta como venda, inclusive os 6 `perdido` e 5 `arquivado` existentes. Em julho não distorceu por sorte; em outros períodos distorce VGV e contagem.

## O que proponho fazer

**Fase 1 — Clareza na tela (só frontend, sem tocar em dados)**
- Rotular explicitamente o que é período e o que é snapshot: subtítulo em cada card ("no período 01–31/07" vs "situação atual do pipeline").
- Quando o VGV assinado do período for zero mas existirem assinaturas no mês, mostrar linha auxiliar: "Nenhuma assinatura no período · mês atual: R$ 4,7M (9 vendas)".
- Separar visualmente o Funil: fases ativas em um bloco, "Ganho no período" em outro.

**Fase 2 — Correção da fonte (SSOT)**
- Ajustar `v_kpi_negocios`: `conta_venda = 1` apenas quando `fase = 'ganho' AND status = 'ativo'`.
- Ajustar `get_kpis_por_periodo`: `vendas` passa a contar por `data_assinatura` no período (mesma janela do `vgv_assinado`), tornando ticket médio = VGV assinado / vendas assinadas.
- Revalidar julho: esperado 9 vendas / R$ 4.740.900 / ticket ~R$ 526,8 mil.

**Fase 3 — Validação ao vivo**
- Conferir no preview com período "Este mês", "Últimos 30 dias" e "Hoje", e checar que Performance/PDN continuam batendo com os mesmos números.

## Detalhes técnicos
- Arquivos: `src/pages/CeoDashboard.tsx`, `src/hooks/useCeoDashboard.ts` (Fase 1); migration para `v_kpi_negocios` e `get_kpis_por_periodo` (Fase 2).
- Sem mudança em `negocios` nem em regra de rateio de VGV (50/50 permanece).
- 1 migration só, dentro do limite diário.
