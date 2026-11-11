# Validação da Lia Recupera (sem enviar mensagem a cliente)

## O que já vi no banco
- Fila de recuperação: 551 enviados, 37 pendentes, 1 cancelado.
- Última campanha concluída em 30/08 (389 contatos). Uma campanha de 27/08 ("não atende") está pausada com envios pendentes.
- 249 conversas registradas no estado da Lia.
- Nenhum agendamento da Lia aparece no monitor de agendamentos (precisa confirmar se é só falta de registro ou se realmente não roda).

## O que vou conferir (somente leitura, nada é disparado)
1. Interruptores: piloto, disparo de recuperação e caixa da Lia. Estão desligados ou ligados? Quem pode ligar?
2. Agendamentos: os que enviam mensagens, os que dão seguimento e os que respondem existem, estão ativos e rodaram sem erro nas últimas 24h.
3. Funções no servidor: recebem chamadas só com autorização (correção da auditoria) e respondem ao teste sem enviar nada.
4. Modelos de mensagem do WhatsApp aprovados pela Meta e qualidade do número, e se a trava de spam de julho segue ativa.
5. Fila: os 37 pendentes ainda são válidos? Nenhum está no pipeline ativo, na lista de saída (opt-out) ou com envio duplicado.
6. Regras de conversa: "35 anos com ressalva", nunca inventar valor e "só descartes" aplicadas no texto atual.
7. Tela da Lia (6 áreas no topo), no computador (1280px) e no celular (390px): números batem com o banco e nada é zero por erro de leitura.
8. Simulação no Laboratório com conversa fictícia, sem WhatsApp real.

## Entrega
Um relatório curto: **Pronta / Pronta com ressalvas / Não pronta**, com o que falta, quem decide e prints. Não ligo nada sozinho, porque ligar o envio é decisão sua.

## Detalhes técnicos
Tabelas lia_estado, lia_reengajamento_fila/runs, lia_followups, lia_envio_reservas, meta_supressao, cron.job/job_run_details, edge logs lia-*, curl sem payload de envio, Playwright em /lia.
