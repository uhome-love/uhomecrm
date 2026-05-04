## Ranking Pipeline de Leads — Nova estrutura

### Conceito
Hoje o ranking ordena por **leads ativos (DESC)**, o que premia acúmulo. Vamos trocar para medir **conversão real**: do que entrou na mão do corretor no período, quanto virou visita e quanto virou negócio. Isso responde "quem está gerindo melhor seus leads?" de forma justa entre quem recebe muito e quem recebe pouco.

### Colunas da tabela (na ordem)
1. **Leads ativos** — snapshot atual (não arquivados, fora de Descarte). Volume de trabalho que o corretor segura hoje.
2. **Virou visita** — nº de leads recebidos no período cuja jornada chegou em qualquer etapa de visita (Visita Marcada, Visita, Visita Realizada, Pós-Visita) ou além.
3. **Virou negócio** — nº de leads recebidos no período que chegaram em Negócio Criado, Negociação ou Venda.
4. **Conversão** — `(Virou visita / Leads recebidos no período) %`. Métrica principal de ordenação.
5. **⚠️ SLA atrasado** — nº de leads ativos com SLA vencido, usando a regra oficial do sistema (mesma da [SLA Logic](mem://rules/business/sla-and-overdue-logic) — BRT, 48h sem ação real, suprimida quando há tarefa futura). Sinaliza disciplina sem entrar no critério de ordenação principal.

### Ordenação
- **Padrão:** `Conversão % DESC` → desempate por `Virou negócio DESC` → `Virou visita DESC` → `SLA atrasado ASC`.
- Mantém a ordenação clicável já implementada por coluna.
- **Sem volume mínimo** (decisão do usuário). Para evitar topo distorcido por corretor com 1 lead, mostramos a coluna "Leads recebidos no período" como contexto visual abaixo do nome (badge cinza pequena).

### Período
- Usa o filtro de período já existente da página (`filters.start` / `filters.end` em BRT).
- "Leads ativos" e "SLA atrasado" continuam **snapshot atual** (estado hoje), com tooltip explicando.
- "Virou visita", "Virou negócio" e "Conversão" usam o **período selecionado** (baseado em `data_lead` do `pipeline_leads`).

### Detalhes técnicos
**Arquivo:** `src/hooks/useRankingsData.ts` — `fetchPipelineLeads()`.

Stages (do banco):
- Visita+: `c9fcf0ad…` (Visita Marcada), `a857139f…` (Visita), `5ad4f4aa…` (Visita Realizada), `d932fb49…` (Pós-Visita), `de6cee2f…` (Proposta), `a8a1a867…` (Negócio Criado), `213e9ca3…` (Negociação), `2d7739eb…` (Venda), `8c1eed68…` (Contrato Gerado).
- Negócio+: `a8a1a867…`, `213e9ca3…`, `2d7739eb…`, `8c1eed68…`, `de6cee2f…`.

Queries (todas via `fetchAllPaged` para furar o cap de 1000):
1. **Snapshot ativos:** `pipeline_leads` `arquivado=false`, `corretor_id IN (ids)`, fora de Descarte → conta `ativos` por corretor + flag SLA.
2. **Período (conversão):** `pipeline_leads` filtrado por `data_lead` no intervalo + `corretor_id IN (ids)` → para cada lead, classifica em "virou visita" / "virou negócio" pelo `stage_id` atual.
3. **SLA atrasado:** reaproveita lógica existente (`ultima_acao_at` > 48h em BRT, suprimida se há tarefa futura). Como já temos `ultima_acao_at` no select, e não temos acesso barato a "tarefa futura" em massa, vamos com a aproximação `now - ultima_acao_at > 48h` (igual ao "Desatualizados" atual) e renomeamos para `SLA atrasado` para alinhar com a linguagem do sistema.

**Componente:** `src/components/ranking/v2/RankingPipelineLeads.tsx`
- Trocar colunas e `primaryRender` para mostrar **Conversão %** como métrica principal.
- Mostrar `Leads recebidos` em badge sutil ao lado do nome (passar via `subtitle` se existir, ou estender `RankingTable`).

**PDF (`src/lib/exportRankingsPdf.ts`):** atualizar a página "Pipeline" com as novas colunas.

**Tipo:** atualizar `PipelineLeadsRow` para `{ ativos, recebidos_periodo, virou_visita, virou_negocio, conversao_pct, sla_atrasado }`.

### Fora de escopo
- Não alterar Ranking de Leads, Visitas ou Negócios.
- Não tocar nas regras de SLA do sistema — só consumir.
