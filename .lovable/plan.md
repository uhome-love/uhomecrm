# Som de Natal da visita marcada no Placar

## O que muda
- **Visita marcada:** sinos tilintando por cerca de 1 segundo e, logo depois, um "Ho ho ho!" do Papai Noel (cerca de 2 segundos no total).
- **Visita realizada:** continua tocando Jingle Bells, sem mudança.
- Vale só no período de Natal. Depois de 26/12, o placar volta ao som normal.
- O botão que liga e desliga o som e os efeitos continua funcionando igual.

## Como fica
- O sino é sintetizado, como as notas que tocam hoje.
- O "Ho ho ho" vem de um áudio curto de voz de Papai Noel, gratuito e liberado para uso. Ele fica guardado na pasta de Natal, para ser apagado junto com a campanha.
- Se o áudio não carregar, toca só o sino. O placar nunca fica em silêncio e nunca trava.

## Detalhes técnicos
- `src/natal/PlacarNatal.tsx`: nova função `tocarVisitaMarcadaNatal(ctx)` com sinos (parciais inarmônicos e decaimento) e, em seguida, a reprodução do `ho_ho_ho.mp3`.
- Áudio enviado como asset CDN, com o ponteiro em `src/natal/`.
- `src/pages/PlacarDoDia.tsx`: quando `natal && !realizada`, chama a nova função em vez de `NATAL_NOTAS_MARCADA`. O caminho de visita realizada não muda.
- Validação: abrir o placar e disparar um anúncio de teste só na tela, sem criar visita. Conferir que nada no console dá erro.
