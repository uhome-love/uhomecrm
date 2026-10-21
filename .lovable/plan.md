# Recusar no sistema pedidos de entrada na Roleta feitos fora do horário

## O que muda
- Os horários de entrada continuam os mesmos de hoje: manhã 07:00–09:30, tarde 12:00–13:30, noite 18:00–21:30, domingo e feriado 08:00–23:30.
- Se o corretor pedir entrada fora desses horários, o próprio sistema recusa o pedido. Ele vê a mensagem "Credenciamento da tarde fechado. Abre às 12:00 e fecha às 13:30.", com o turno e os horários de cada caso.
- Pedidos feitos dentro do horário, e já aprovados, ficam como estão.
- "Incluir manualmente na fila", da gestão, continua liberado a qualquer hora.
- A distribuição de leads não muda.

## Como validar
- Conferir que um pedido feito agora, fora do horário da tarde, é recusado com a mensagem certa, sem gravar nada.
- Conferir que um pedido da noite, dentro do horário, continua passando. A conferência usa uma simulação que é desfeita no fim, sem criar pedido de verdade.
- Conferir que a Roleta da gestão continua abrindo normal.

## Detalhes técnicos
- Nova função `public.roleta_janela_cred_aberta(p_janela text) returns boolean` (stable, horário BRT), com as mesmas janelas de `src/lib/roletaJanelaCred.ts`. Domingo e feriado (`public.feriados`) usam `dia_todo`.
- `credenciar_por_alocacao(p_janela)` e `credenciar_na_roleta(...)`: no início, se a janela estiver fechada, retornam `{success:false, error:<mensagem>}`. O resto da lógica fica igual: as definições atuais são lidas e recriadas só com essa checagem a mais.
- Uma migration só, com DDL apenas e a autorização do Lucas para rodar antes das 19h.
- Teste novo em `roletaJanelaCred.test.ts` com a janela da noite começando às 18:00.
