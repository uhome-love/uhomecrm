## Problema

O KPI "Negócios" no Dashboard do Gerente (`/gerente/dashboard`) está contabilizando **todos os negócios da empresa com `status = 'ativo'`**, incluindo fases finalizadas (`vendido`, `distrato`, `perdido`). Resultado: ~177 negócios em vez dos ~13 realmente em andamento.

A função RPC `get_dashboard_gerente_v4_kpis`, no CTE `negocios_ativos_total`, filtra apenas por `status = 'ativo'` sem excluir as fases de encerramento.

## Correção

Ajustar o CTE `negocios_ativos_total` da função `get_dashboard_gerente_v4_kpis` para:

1. Manter o escopo do time do gerente (`corretor_id = ANY(v_team_prof)`) — já está correto.
2. Manter `status = 'ativo'`.
3. **Adicionar** filtro: `fase NOT IN ('vendido', 'distrato', 'perdido')`.

Assim só entram negócios efetivamente em andamento (`novo_negocio`, `proposta`, `negociacao` e quaisquer fases ativas futuras), alinhado ao grupo "🔄 Em andamento" do Pipeline de Negócios.

## Detalhes técnicos

- Migration única: `CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_kpis(...)` reescrevendo a função inteira, alterando somente o CTE `negocios_ativos_total`.
- Sem mudanças no frontend: `V4KpisGrid` já lê `kpis.negocios_ativos` do payload.
- Sem mudanças em outros KPIs (Leads, Visitas, Vendas) nem nos painéis (`V4PanelNegocios`, alertas, roleta).

## Fora de escopo

- Dashboard CEO e demais agregações.
- Painel `V4PanelNegocios` (lista detalhada).
- Metas de negócios (`negocios_meta`).
