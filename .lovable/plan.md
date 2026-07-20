Nenhuma alteração de código nesta rodada — a pergunta foi de opinião sobre o deck da reunião semanal.

## Slides adicionais sugeridos

**1. Velocidade de resposta da roleta (SLA de 1º contato)**
- Fonte: `get_distribuicao_performance` (tempo médio, aceitos, timeouts por corretor/segmento) + `v_kpi_gestao_leads` ponto "Contato Iniciado".
- Mostrar: mediana e p90 de tempo até 1º contato, % <5min, ranking top/bottom 3, taxa de timeout.

**2. Saúde do pipeline por corretor (leads parados / VGV preso)**
- Fonte: `get_time_agregado` (sem_tarefa, atrasados, sem_contato_5d, alerta_principal) + `usePipelineEstagnacao` + PDN.
- Mostrar: top 5 com mais atraso, VGV parado em Aquecimento/Visita >14d, respostas positivas de WhatsApp ainda não reativadas.

**3. Motivo de perda × origem/criativo (fecha loop com Marketing)**
- Fonte: `pipeline_leads.descarte_motivo` + origem/origem_detalhe (conjunto/criativo Meta) + `get_relatorio_origem_performance`, cruzado com CAC por conjunto e filtro `lead_teve_contato_v3`.
- Mostrar: matriz origem × motivo, CAC ajustado por contato real, 1 ação por conjunto (pausar/dobrar/ajustar).

**Bônus:** Curva de aquecimento (média de interações/dias em cada etapa até o ganho), de `pipeline_atividades` — ancora a régua "4,4 tarefas até vender".

## Próximo passo

Se quiser, posso montar as queries SQL prontas para cada um desses 3 slides (read-only) e devolver os números da semana já formatados para o deck. Me confirma qual(is) quer que eu execute — ou se prefere que eu gere também o texto/tabela pronta para colar no PPT.
