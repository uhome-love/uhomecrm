## Diagnóstico confirmado

O disparo não foi concluído no banco: está `paused`, com **147 itens pendentes** e `cancel_requested = false`. Porém, a função grava `finished_at` até nos caminhos de pausa. Isso faz a UX tratar visualmente a execução como finalizada e esconder o fluxo correto de retomada.

Há ainda duas inconsistências:
- A configuração mostra “Travado — liberação manual via SQL” e desabilita a ação quando `paused_until_release = true`, embora a retomada já exista no hook e deva ser feita pelo botão.
- Ao retomar, a proteção de qualidade considera novamente falhas anteriores ao clique, podendo pausar imediatamente porque não respeita `guard_reset_at`.

## Implementação

1. **Separar pausa de término no motor**
   - Em todos os caminhos recuperáveis de pausa por qualidade, excesso de falhas, pausa manual ou motor desativado: manter `status = 'paused'`, limpar `finished_at` e preservar os itens restantes como `pending`.
   - Somente `completed`, `cancelled`, `timeout`, `no_send` e erro terminal poderão preencher `finished_at`.
   - Garantir que pausa automática nunca marque `cancel_requested`.

2. **Fazer a retomada começar uma nova janela de qualidade**
   - A proteção de 15 minutos passará a usar o maior valor entre o início da janela e `guard_reset_at`.
   - Ao clicar em Retomar, falhas anteriores ao clique deixam de bloquear imediatamente; novas falhas continuam podendo pausar novamente.

3. **Exibir sempre o botão Retomar para run pausada com pendências**
   - O banner continuará encontrando runs `paused` que tenham `pending`/`processing`, independentemente de um `finished_at` legado.
   - Mostrar progresso, quantidade pendente, motivo da pausa e botão **Retomar**.
   - O botão libera `paused`, `paused_until_release` e chama o motor com o mesmo `run_id`, retomando do ponto exato.

4. **Remover o bloqueio incorreto da configuração**
   - Trocar “liberação manual via SQL” por uma pausa operacional retomável.
   - Não desabilitar a retomada por `paused_until_release`; essa flag passa a significar “aguardando decisão humana”, e o botão é justamente essa decisão.

5. **Corrigir feedback da UX**
   - Se a retomada funcionar: “Disparo retomado — 147 pendentes”.
   - Se a Meta voltar a exceder o limite depois da retomada: manter o botão disponível e informar que pausou novamente, sem apresentar como finalizado.
   - No histórico, status pausado permanecerá “Pausado”, nunca “Concluído/Finalizado”.

## Compatibilidade do run atual

A correção contemplará o run `985e0a03-0543-490e-83d7-37964f2ca7e0` sem apagar nem recriar sua audiência: os **147 pendentes atuais** continuarão disponíveis para retomada pelo botão.

## Validação

- Confirmar no banco que pausa deixa `status='paused'`, `finished_at=null` e mantém pendências.
- Validar no preview que o banner aparece com **Retomar**.
- Acionar Retomar e confirmar que o mesmo run volta para `running` e consome a fila existente.
- Confirmar que uma nova auto-pausa continua recuperável e nunca aparece como finalização.