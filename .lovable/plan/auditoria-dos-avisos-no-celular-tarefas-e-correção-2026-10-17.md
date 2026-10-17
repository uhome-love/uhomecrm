# Auditoria dos avisos no celular (tarefas) e correção

## O que está acontecendo (conferido no sistema, últimos 3 dias)
- **865 avisos de tarefa** para 28 corretores, cerca de 10 por dia cada um. Alguns corretores receberam **30 a 39 avisos num único dia**.
- **Cada aviso de tarefa chega 2 vezes no celular.** O sistema manda o push direto e, ao gravar o aviso no sino, manda de novo.
- **Rajada às 9h:** a maioria das tarefas "Próximo contato" é criada para 09:00, então às 9h chegam 20 a 30 avisos de uma vez.
- **"Avisa quando cria ou altera":** o aviso é dado para qualquer tarefa cujo horário já passou há até 1 hora. Por isso:
  - criar uma tarefa para "agora" (ex.: "Ligar agora", "Registrar resultado da visita") já dispara o push na hora;
  - mudar o horário de uma tarefa para agora ou um pouco antes também dispara.
- **Atrasada:** hoje não existe um push separado de atraso. A sensação vem das tarefas já vencidas avisadas logo depois de criar ou alterar.
- Outros avisos que também chegam no celular em volume: "lead desatualizado" (446), "cadência sem contato" (374) e "lead reengajado" (278). Eles não são de tarefa e ficam fora desta correção, a menos que você peça.

## O que proponho (só para tarefas)
1. **Um push só por tarefa**, sem a duplicação.
2. **Avisar só quando a tarefa está vencendo**: 15 minutos antes do horário marcado (janela de até 15 min). Uma vez só.
3. **Nunca avisar** tarefa criada ou alterada já no horário ou depois dele, nem tarefa já atrasada.
4. **Às 9h e em outros horários cheios:** juntar num aviso só quando houver 3 ou mais tarefas no mesmo horário, ex.: "⏰ 09:00 · 12 tarefas para fazer". Com menos de 3, sai um aviso por tarefa, com o nome do cliente.
5. O sino dentro do CRM continua mostrando os avisos normalmente.

## Validação
- Simular com tarefa de teste no seu nome: criada para daqui a 20 min (deve avisar 1 vez, 15 min antes), criada para "agora" (não avisa), alterada para o passado (não avisa). Depois apagar a tarefa e os avisos de teste.
- Conferir no registro de envios que saiu 1 push por tarefa.

## Detalhes técnicos
- Duplicação: `tarefa-aviso-horario` insere em `notifications` (o gatilho `trg_push_on_notification` já chama `send-push`) e também chama `send-push` direto. Remover a chamada direta e manter o log em `ops_events` só como contagem.
- Janela: trocar o filtro `ts <= agora && ts > agora - 60min` por `ts > agora && ts <= agora + 15min`, e ignorar tarefas cujo `created_at`/`updated_at` seja posterior a `ts - 15min` (criadas em cima da hora). O cron já roda a cada 15 min; mudar para a cada 5 min (07–23h BRT) para o aviso não chegar atrasado.
- Agrupamento: agrupar por `responsavel_id + hora`; com 3 ou mais, um único insert com `agrupamento_key = tarefa_lote_<user>_<data>_<hora>`.
- Só a função de borda e o agendamento mudam. Sem migration de tabela e sem mexer em tarefas existentes.
