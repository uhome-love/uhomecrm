## Mudança: Sempre exibir top 5 no card "Pipelines desatualizados"

**Onde**: função `get_dashboard_gerente_v4_kpis` no banco (CTE `alertas_filtrados`).

**O que muda**:
- Remover o filtro `score >= 40`.
- Manter ordenação por `score DESC` e `LIMIT 5`.
- Manter o cálculo de severidade (`crítico` ≥ 70, `atenção` 40–69, e adicionar `ok`/`baixo` para score < 40 para o badge não ficar vazio).

**Resultado**: o card sempre mostra os 5 corretores com maior `tarefas_atrasadas + leads_sem_acao_30d` do time, mesmo que o score seja baixo. Corretores sem nenhuma pendência aparecem com badge neutro.

**Fora de escopo**: UI do card, outras KPIs, lógica de score em si.

Aprove para eu aplicar a migration.