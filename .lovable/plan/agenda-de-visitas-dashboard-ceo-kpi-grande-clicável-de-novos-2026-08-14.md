# Agenda de Visitas (Dashboard CEO): KPI grande clicável de novos agendamentos

## O que muda

No card "Agenda de Visitas" do Dashboard CEO, a faixa fina "24 novos agendamentos no período" vira um **KPI grande, com a largura total do card** (mesma largura dos dois KPIs de baixo somados), no mesmo estilo dos cards Total / A realizar / Realizadas / No Show:

- Número grande em destaque + rótulo "Novos agendamentos no período"
- Comparativo "▲ x% vs. anterior" quando houver período anterior
- É clicável (botão), abrindo um detalhamento

Os 4 KPIs (Total, A realizar, Realizadas, No Show) continuam exatamente como estão, logo abaixo.

## O detalhamento (ao clicar)

Abre um diálogo "Novos agendamentos no período" listando as visitas **criadas** no período, agrupadas assim:

```text
▸ Equipe Junior Padilha                         6 visitas
     William Brizola                            2
        14/08  15:30   Carlos Temes Quadros  · Terrace Vivid   [marcada]
        14/08  10:00   Ana Silva             · Casa Tua Canoas [realizada]
     Paula Medeiros                             1
        ...
▸ Equipe Bruno                                  4 visitas
▸ Sem equipe                                    1 visita
```

- Ordenação: equipe (maior volume primeiro) → corretor → data/hora da visita
- Cada linha mostra data, horário, cliente, empreendimento e status
- Clicar na linha abre o lead (mesmo comportamento dos demais detalhamentos do CEO)
- Grupos de equipe recolhíveis; contagem por equipe e por corretor no cabeçalho de cada grupo

## Detalhes técnicos

- `src/pages/CeoDashboard.tsx`: substituir a faixa de texto (linhas ~696-699) por um card KPI full-width (`col-span-2` acima do grid de 4), reaproveitando o mesmo visual/animação dos demais e chamando `setKpiDetail({ type: "novos_agendamentos", label: "Novos agendamentos" })`. Delta calculado com `agendaVisitasPrev.agendadas` pelo helper `delta()` já existente.
- `src/components/ceo/KpiDetailDialog.tsx`: novo tipo `"novos_agendamentos"` em `KpiDetailType`. Consulta em `visitas_unicas` filtrando `created_at` na janela BRT→UTC (`brtRangeToUTC`, já usado no tipo `visitas_criadas`), trazendo `corretor_id, gerente_id, nome_cliente, empreendimento, data_visita, hora_visita, status, pipeline_lead_id`.
- Nomes: uma consulta a `profiles` (corretores e gerentes) para resolver nomes; a equipe vem de `gerente_id` da visita, com fallback em `team_members` quando `gerente_id` estiver nulo, e "Sem equipe" quando não houver.
- Renderização agrupada: como o diálogo atual é uma lista plana, o modo agrupado fica em um sub-componente novo (`src/components/ceo/VisitasPorEquipeList.tsx`) usado só por esse tipo — os demais KPIs seguem intactos.
- Somente leitura: nenhuma migration, nenhuma alteração de regra de negócio de visitas.
