# Roleta: 2 visitas na semana atual liberam na hora (a partir de 19/10)

## Regra
A partir de segunda, 19/10, o corretor pode se credenciar se cumprir **uma** destas condições:
- fez 2 visitas realizadas na semana passada (segunda a domingo); **ou**
- já fez 2 visitas realizadas na semana atual. Nesse caso a liberação vale na hora, sem esperar o domingo fechar.

O resto continua igual: CRM de 80% ou mais, até 100 descartes, credenciamento manual pelo botão e os horários de sempre. Na Roleta noturna continua sendo preciso ter uma visita marcada ou realizada no dia. No domingo, a regra das 2 visitas de segunda a sábado não muda.

Exemplo real: o corretor X não teve visitas na semana 1 e começa a semana 2 bloqueado. Na quinta ele registra a 2ª visita realizada e o CRM dele está em 80% ou mais. A partir do turno seguinte, ele aperta o botão de credenciamento e volta a receber leads. Como já tem 2 visitas na semana 2, ele também fica apto para receber na semana 3 inteira.

## Tela (Minha Rotina)
O cartão de visitas do quadro da Roleta passa a mostrar as duas semanas:
- "Semana passada: 0 / mín. 2 · Esta semana: 1 de 2 — com mais 1 você já libera"
- Fica com ✓ quando qualquer uma das duas semanas tiver 2 visitas.

## Validação
- Simular sem deixar mudança no sistema (a trava das visitas fica ligada só durante o teste): um corretor com 0 visitas na semana passada e 2 na atual deve ficar liberado; com 1 visita, bloqueado.
- Conferir que nada muda até 19/10, com a trava das visitas desligada.

## Detalhes técnicos
- Em `roleta_apto_janela`, a checagem das visitas passa a aceitar a semana anterior **ou** a semana atual até hoje (`roleta_visitas_realizadas_periodo(seg_atual, hoje)`) com o mínimo de visitas.
- Fazer a mesma mudança em `roleta_motivo_bloqueio`, para a mensagem de bloqueio bater com a regra.
- `RoletaTurnoCard` passa a usar `semanaAtual`, que já vem de `useMinhaEvolucao`.
- Uma migração, aplicada fora do horário comercial.
