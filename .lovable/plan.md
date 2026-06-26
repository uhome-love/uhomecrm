Diagnóstico atual
- Não há run `running` agora: o disparo não está continuando.
- A central travou por `paused=true` e `paused_until_release=true`.
- O motivo foi o guard de qualidade do Meta: nas últimas 2h houve 52 entregues, 24 lidos, 2 respondidos, mas também 8 falhas de “healthy ecosystem engagement” e 6 “Message undeliverable”.
- O modelo atual ainda é frágil: cada lote roda dentro da Edge Function por até ~110s e tenta chamar uma continuação. Quando o guard pausa ou a continuação cai, o disparo deixa de avançar.

Plano de correção

1. Destravar de forma controlada
- Encerrar qualquer run parado/pausado da retomada atual com motivo explícito.
- Liberar `reengajamento_config` apenas para voltar a operar, sem apagar o histórico de falhas.
- Retomar com limite conservador, não com 3000 de uma vez, para evitar novo bloqueio imediato da Meta.

2. Parar de depender de “continuação em cadeia”
- Criar uma fila persistente de destinatários por disparo.
- No início do disparo, calcular a audiência uma vez e gravar os destinatários pendentes.
- Cada chamada da função processa poucos pendentes e termina rápido.
- Se a função cair, o próximo acionamento continua do próximo pendente, sem recalcular público inteiro e sem perder o estado.

3. Criar um worker idempotente e retomável
- Adaptar `reengajamento-descartados-enqueue` para:
  - criar o run e popular a fila quando for um novo disparo;
  - processar apenas um lote pequeno por chamada;
  - marcar cada item como `sent`, `failed`, `skipped` ou `suppressed`;
  - não reenviar o mesmo telefone/template se já houver item processado;
  - usar trava single-flight por run, evitando dois workers simultâneos.

4. Trocar a pausa por “modo throttled” quando o template ainda entrega bem
- Manter pausa forte quando houver bloqueio grave.
- Para casos como agora, onde há entregas/leitura mas também 131049, reduzir automaticamente cadência e tamanho do lote em vez de travar tudo.
- Critério proposto:
  - 131049 recente com entrega ainda saudável: continuar em micro-lotes lentos.
  - falha acima de limite crítico ou template pausado/rejeitado: pausar até liberação.

5. Ajustar a interface da Central
- Mostrar estado real: “rodando”, “em modo lento”, “pausado por Meta”, “aguardando próxima leva” ou “concluído”.
- O botão de disparo deve permitir “Retomar fila pendente” quando houver run pausado com destinatários pendentes.
- O toast deve diferenciar bloqueio real da Meta de pausa preventiva do nosso guard.

6. Validar antes de retomar em volume
- Conferir que existe 0 run preso.
- Conferir quantos destinatários pendentes/limpos restam da seleção atual.
- Rodar uma retomada pequena e confirmar criação/avanço da fila.
- Só depois liberar a continuidade automática em micro-lotes.

Arquivos/áreas afetadas
- Edge Function `reengajamento-descartados-enqueue`.
- UI `DisparoCustomizadoCard.tsx` e possivelmente `LiveDispatchBanner.tsx` para status/retomada.
- Banco: nova tabela de fila de envio do reengajamento com permissões para o backend e leitura autenticada para acompanhamento.

Resultado esperado
- O disparo não fica mais “travado” por timeout/continuação perdida.
- Se a Meta limitar temporariamente, a central reduz velocidade em vez de morrer silenciosamente.
- A retomada passa a ser segura: continua dos pendentes, sem duplicar envios e sem recalcular a lista toda.