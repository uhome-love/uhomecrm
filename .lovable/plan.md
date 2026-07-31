# Uma visita por cliente por dia (SSOT)

Hoje o CRM conta cada registro da tabela de visitas como uma visita. Se o corretor agenda o mesmo cliente em dois produtos no mesmo dia, o placar, o funil e os rankings contam 2.

Auditoria dos últimos 30 dias: 329 combinações cliente+dia, **10 com duplicidade, 11 registros excedentes** (ex.: Felipe Teixeira 01/08 Terrace + Open; Marcelo Amazonas 01/08 Casa Tua 2x; Marilá Picoloto 13/07 3x).

## Regra canônica

Uma visita = **um cliente em um dia**, independente de quantos produtos/empreendimentos.

- Chave do cliente: `pipeline_lead_id` quando existe; senão nome do cliente normalizado (minúsculo, sem espaços extras).
- Quando há mais de um registro na mesma chave+dia, elege-se a **visita principal**: melhor status primeiro (`realizada` > `confirmada` > `marcada`/`reagendada` > `no_show` > `cancelada`) e, em empate, a criada primeiro.
- Só a visita principal conta em KPIs, placar, funil, metas e rankings. As demais continuam existindo (histórico do lead, agenda, timeline) — apenas não pontuam.
- Caso raro de dois corretores diferentes com o mesmo cliente no mesmo dia (1 ocorrência em 30 dias): também conta 1, e o crédito vai para a visita principal. Se preferir contar 1 por corretor nesse caso, é só avisar que ajusto a chave.

## Fase 1 — Fonte única (migração 1)

- Recriar `v_fato_visita` com as colunas novas `cliente_key`, `seq_dia` e `visita_principal_dia` (boolean), calculadas por `ROW_NUMBER()`.
- Recriar `v_kpi_visitas` com a mesma marcação, para não sobrar caminho antigo contando duplicado.
- Nenhuma linha é apagada; nada muda visualmente ainda.

## Fase 2 — Aplicar a regra em quem conta (migração 2)

Revisar e filtrar por `visita_principal_dia` em todas as funções que contam visitas:

`rpc_metricas`, `rpc_metricas_detalhe`, `rpc_perf_dashboard`, `get_kpis_por_periodo`, `get_relatorio_visitas`, `get_relatorio_equipes`, `get_relatorio_cohort`, `get_relatorio_origem_performance`, `get_ranking_central`, `get_corretor_daily_visitas`, `get_corretor_pdn`, `get_dashboard_gerente_v4_dia`, `get_dashboard_gerente_v4_kpis`, `get_team_visitas`, `rpc_placar_do_dia`, `rpc_placar_mutirao`, `_kpi_team_window_core`.

Cada uma é auditada antes de alterar; as que só listam visitas (agenda) continuam mostrando todos os registros, com o contador exibindo o número único.

Também no Mutirão: o gatilho `trg_visita_conta_mutirao` deixa de pontuar (30 pts) a segunda visita do mesmo cliente no mesmo dia.

## Fase 3 — Frontend

- Remover os "remendos" de deduplicação feitos à mão no Dashboard CEO (`useCeoDashboard.ts` / `CeoDashboard.tsx`), já que a regra passa a vir do banco.
- Painéis de agenda (Visitas da Equipe, aba Visitas do lead) continuam listando tudo, com badge "mesmo cliente" no registro extra para o corretor entender por que não somou.

## Fase 4 — Validação ao vivo

Conferir no preview, com os casos reais já mapeados: placar do Mutirão, Dashboard CEO (Agenda de Visitas), Performance (funil e Meus resultados), PDN e agenda da equipe — todos devem mostrar o mesmo número único.

## Notas técnicas

- Duas migrações apenas (limite diário respeitado): a primeira só recria views, a segunda ajusta funções e o gatilho.
- Sem alteração de dados existentes e sem exclusão de visitas duplicadas.
- Nenhuma mudança de escrita/agendamento nesta etapa; bloquear a criação de visita duplicada no mesmo dia fica como fase futura, se desejar.
