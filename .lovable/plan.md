## Diagnóstico

- O disparo atual está realmente em andamento: começou às 16:42 BRT, com 576 alvos, 122 enviados, 1 falha síncrona e 33 ignorados no registro da execução.
- A tabela de auditoria usa `reengajamento_meta_disparos`, que só recebe linha quando o envio Meta retorna sucesso. Falhas síncronas e ignorados ficam na fila (`reengajamento_dispatch_queue`) e/ou no resumo da execução, então a parte de baixo pode parecer parada ou vazia.
- O painel “Disparos recentes” existe, mas está fechado por padrão. Isso esconde justamente o resumo que ajudaria a entender se está enviando, falhando ou ignorando.

## Plano de correção

1. **Mostrar a execução atual sempre aberta no Ao vivo**
   - Deixar “Disparos recentes” aberto automaticamente quando houver run `running`.
   - Destacar o disparo em andamento com progresso, template, origem, enviados, falhas e ignorados.

2. **Criar uma lista de atividade em tempo real da fila**
   - Na aba Ao vivo, consultar `reengajamento_dispatch_queue` do run atual/recentes.
   - Exibir os últimos itens processados com: horário, lead, telefone, template, status (`sent`, `failed`, `skipped`, `suppressed`, `pending`, `processing`) e erro quando houver.
   - Assim falhas que não aparecem em `reengajamento_meta_disparos` passam a aparecer imediatamente.

3. **Manter a auditoria Meta como resultado final de entrega/resposta**
   - A tabela atual de `reengajamento_meta_disparos` continua mostrando entregas, leituras e respostas.
   - A nova lista da fila fica acima dela como “envios sendo processados agora”.

4. **Ajustar atualização ao vivo**
   - Recarregar a execução/fila em intervalo curto enquanto houver disparo em andamento.
   - Invalidar os dados ao receber eventos realtime da fila, igual já acontece com a auditoria Meta.

5. **Validar**
   - Confirmar que o disparo atual mostra itens recentes mesmo quando há falhas ou ignorados.
   - Rodar validação TypeScript após a alteração.