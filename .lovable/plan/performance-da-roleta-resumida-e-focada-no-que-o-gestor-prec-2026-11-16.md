# Performance da Roleta — resumida e focada no que o gestor precisa

Vale para a aba "Performance da Roleta" do Painel CEO, diretora e gerente. Só tela; nenhuma regra da Roleta muda. Desenho: Mockup_Performance_Roleta.jpg (números ilustrativos).

## O que o gestor vai ver (de cima para baixo)
1. **4 números**: Aptos agora (e quantos voltaram desde segunda) · Fora da roleta (separado por motivo: visitas, CRM, descartes) · Perto de voltar (têm visita marcada que completa as 2) · Visitas realizadas na semana + marcadas até domingo.
2. **Fora da roleta — o que falta para voltar**: nome, equipe, o que falta ("1 visita", "CRM 72% → 80%, atualizar 6 clientes"), barra da semana (realizadas + marcadas) e selo: Perto / CRM / Sem agenda. Ordem: quem está mais perto primeiro.
3. **Aptos agora**: nome, por quê (visitas da semana passada ou "completou 2 visitas hoje") e selo "voltou hoje".
4. **Evolução da semana**: aptos por dia de segunda até hoje; dias seguintes tracejados com a previsão se as visitas marcadas acontecerem.
5. **Últimas 6 semanas**: aptos, visitas e média por corretor; clicar abre corretor por corretor (o fechamento semanal atual fica dentro desse clique).
- Filtro de equipe e "Baixar PDF" continuam. A tabela de saúde do CRM por equipe sai desta aba (já existe na Visão geral).
- Celular: números em 2x2, listas em cartões, sem rolagem lateral.

## Regra usada (a mesma de hoje)
Apto = CRM ≥ 80% e 2 visitas realizadas na semana passada **ou** 2 já nesta semana (volta na hora em que completa). Domingo: 2 visitas de seg a sáb.

## Detalhes técnicos
- Estender `rpc_performance_roleta` (1 migration, fora do expediente) para devolver por corretor: `visitas_marcadas_semana` (visitas futuras até domingo), `apto_desde`/`voltou_hoje`, e série diária de aptos da semana calculada com a mesma `roleta_visitas_realizadas_periodo`. CRM diário histórico não existe: a série usa o CRM atual (aviso discreto na tela).
- Últimas 6 semanas vêm de `roleta_fechamento_semanal` (agregado).
- Dividir `PerformanceRoletaTab.tsx` em: KPIs, ForaDaRoleta, AptosAgora, EvolucaoSemana, UltimasSemanas; seletores puros em `src/lib/performanceRoletaPresentation.ts` com testes (perto de voltar, o que falta, ordenação).
- Validar ao vivo como CEO e gerente, desktop 1280 e celular 390.
