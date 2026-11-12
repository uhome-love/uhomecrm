# Relatório de progresso — desde a trava da Roleta (2 visitas + CRM em dia)

Só leitura: nada muda no CRM, nos leads ou na Roleta. O resultado é um documento para você.

## 1. Achar o dia de início
- Confirmar no histórico do sistema o dia em que as regras de visitas e CRM foram ligadas na Roleta.
- Conferir o percentual: nas regras atuais está 70% de CRM em dia, e você falou em 80%. O relatório mostra o valor real e quando mudou, se mudou.

## 2. Comparar "antes" e "depois"
Mesmo número de semanas antes do início contra o período do início até hoje (11/11/2026), por semana, por corretor e por equipe (com a equipe da época de cada fato).

- **Performance:** leads recebidos, visitas marcadas e realizadas, propostas, vendas ganhas e VGV (regra oficial, parceria 50/50).
- **Atualização (CRM em dia):** % da carteira em dia, desatualizados e estagnados, com a régua atual (visita ou tarefa futura conta como em dia).
- **Trabalho:** atividades registradas, ligações e aproveitamentos da Oferta Ativa, tarefas concluídas.
- **Visitas:** realizadas por semana (parceria vale 0,5), quantos corretores bateram 2, quem ficou de fora da Roleta e se voltou na semana seguinte.
- **Roleta:** corretores aptos por semana (fechamento semanal) e motivos de bloqueio.

## 3. Análise
- O que melhorou, o que piorou e o que ficou igual.
- Destaques e quem precisa de atenção, por nome.
- Limites dos dados: semana atual ainda incompleta (comparada até o mesmo dia), feriados e outras mudanças que aconteceram ao mesmo tempo (Oferta Ativa nova, campanha de Natal).
- Recomendações práticas.

## Entrega
- Documento em PDF com gráficos, mais uma versão curta para WhatsApp.
- Prints conferidos no computador e no celular.

## Detalhes técnicos
- Início: histórico de `roleta_config` (`crm_gate_ativo`, `visitas_gate_ativo`) e `audit_log`.
- Fontes: `v_negocios_pipeline`, `roleta_visitas_realizadas_periodo`, `roleta_fechamento_semanal`, `crm_saude_corretor`, `pipeline_atividades`, `oa_events`, `pipeline_tarefas`, `equipe_historico` + `fn_equipe_na_data`. Datas em BRT.
- Só consultas de leitura, sem nenhuma mudança no banco.
