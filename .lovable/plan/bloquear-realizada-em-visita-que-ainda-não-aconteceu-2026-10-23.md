# Bloquear "realizada" em visita que ainda não aconteceu

## O que foi confirmado
- A visita da Daniele (Larissa) está marcada para 24/10 às 20:42, mas foi registrada hoje (23/10, 16:53) como "realizada" com o resultado "não gostou".
- Existem 2 visitas no sistema com resultado registrado (realizada ou no-show) antes do horário marcado: a da Daniele e mais uma.

## Regra nova
Uma visita só pode virar **Realizada** ou **Não compareceu** depois que a data e o horário dela já passaram (no horário de Brasília). Antes disso, as únicas opções são **Reagendar** ou **Cancelar**.

## O que muda
1. **Na tela**: o pop-up de resultado da visita, os botões rápidos da agenda e o arrasto entre colunas escondem ou desativam "Realizada" e "Não compareceu" em visita futura, com o aviso "A visita ainda não aconteceu (24/10 às 20:42)".
2. **No servidor (trava definitiva)**: o banco recusa qualquer tentativa de colocar realizada ou no-show em visita futura, mesmo que alguma tela antiga deixe passar. A mensagem de erro explica o motivo.
3. **Correção dos 2 casos**: a visita da Daniele e a outra voltam para "marcada" e o resultado é apagado. O cliente volta para a etapa Visita, com uma anotação no histórico. Antes de mexer, eu te mostro a lista dos 2 casos.

## Validação
- Cliente de teste na carteira da Larissa com visita amanhã: o pop-up não oferece "Realizada", e a tentativa direta é recusada.
- Visita de teste no passado: o registro funciona normal. Depois apago o cliente de teste.
- Confiro que a contagem de visitas da Roleta da Larissa fica certa depois da correção.

## Detalhes técnicos
- Trigger BEFORE UPDATE/INSERT em `visitas`: se NEW.status in ('realizada','no_show') e (data_visita + hora_visita) > now() em BRT → RAISE EXCEPTION. Sem hora = vale o fim do dia.
- Frontend: helper `visitaJaPassou(data, hora)` em `src/lib/brtTime.ts`, usado em `VisitaResultadoDialog`, `AgendaVisitas` e `useVisitas.updateStatus`.
- Correção dos dados via SQL, registrando em `audit_log`; o lead volta à etapa Visita com flag `status_visita=marcada`.
