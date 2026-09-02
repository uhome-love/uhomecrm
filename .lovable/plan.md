# Novos agendamentos: deixar claro que o número é "visitas marcadas no dia"

## O que os dados mostram

Conferi as visitas criadas em 01/09 (o período do print): **15 visitas criadas**, exatamente o número do KPI. Dessas 15, 11 seguem `marcada` e 4 já tiveram desfecho no mesmo dia (2 `realizada`, 2 `no_show`) — todas eram visitas marcadas para 01/09 e aconteceram (ou o cliente faltou) no próprio dia.

Ou seja: o KPI **já conta exatamente o que você quer** — toda visita que o time marcou naquele dia, contada pelo dia em que foi marcada (`created_at` em BRT), sem contar canceladas nem backfill. Nenhuma visita antiga entra no número por ter sido realizada no período.

O que confunde é a lista do detalhamento: ela mostra o **status atual** de cada visita, então aparecem etiquetas "realizada" e "no_show" ao lado de agendamentos que sim nasceram naquele dia. Parece que o número está somando realizadas/no-show, mas não está.

## Proposta (só apresentação, zero mudança de cálculo)

1. No card do Dashboard CEO, abaixo de "Novos agendamentos no período", uma linha fina explicando a regra: "visitas marcadas no período (contadas pelo dia da marcação)".
2. No diálogo de detalhamento:
   - subtítulo passa a ser "15 visita(s) marcada(s) no período · o status mostra a situação atual da visita";
   - as etiquetas de status ganham cor discreta (cinza para marcada/confirmada, verde para realizada, âmbar para no_show) para ficar claro que é situação atual, não critério de contagem;
   - resumo no topo do diálogo: "11 em aberto · 2 realizadas · 2 no show" — o total continua sendo 15.

## Detalhes técnicos

- `src/pages/CeoDashboard.tsx`: uma linha de legenda no card KPI.
- `src/components/ceo/VisitasPorEquipeList.tsx` + `src/components/ceo/KpiDetailDialog.tsx`: subtítulo, resumo por status e cor das badges.
- Nenhuma migration. A RPC `get_visitas_kpis` (campo `agendadas`) fica intacta.

## Se a regra desejada for outra

Se, apesar disso, você quiser que uma visita que já foi realizada ou deu no-show **saia** do número de novos agendamentos (01/09 cairia de 15 para 11), é só dizer — nesse caso a mudança vira uma alteração da RPC, e eu ajusto o plano.
