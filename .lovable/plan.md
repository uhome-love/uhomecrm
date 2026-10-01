# Open Bosque — pronto para disparar os 19 leads da Fila do CEO

## Resultado da verificação (nada precisa ser alterado)
- **10 corretores estão aptos agora** (alocados no Open Bosque, com o turno da tarde aprovado e ativos na roleta): Douglas Costa, Ebert Silva, Géssica Santos, Gustavo Niz, Jéssica França, Lucas Johnson, Marcos Aurelio Farias, Pedro Jorge, Roni Klusener e Wendel Flores.
- **Por que antes foi tudo para o Douglas:** às 14:21 ele era o único alocado no Open Bosque. Os outros 9 foram alocados às 14:24, depois do disparo.
- **Agora vai dividir:** a roleta manda primeiro para quem recebeu menos Open Bosque hoje. O Douglas já conta 19 hoje, então vai ficar por último. Os 19 leads vão se espalhar entre os outros 9, cerca de 2 por corretor.
- **Os 19 leads estão prontos:** na Fila do CEO, sem corretor, como Open Bosque, e o produto está ativo.
- **Horário:** o turno da tarde vai até 18:30. Dispare antes disso. Depois desse horário, só recebe quem estiver no turno da noite.
- **Aceite:** cada corretor tem 10 minutos para aceitar. Se não aceitar, o lead passa para o próximo apto.

## O que fazer
1. Disparar os 19 pela Fila do CEO agora.
2. Depois do disparo (se quiser), eu confiro quem recebeu cada lead e quantos foram para cada corretor.

## Detalhes técnicos
- A distribuição exige alocação em `corretor_alocacao.empreendimentos` mais credenciamento aprovado hoje, na janela atual ou "dia todo", com `roleta_fila.ativo` e `na_roleta` ligados.
- A ordem é por `recebidos_no_produto` (contados em `roleta_distribuicoes` de hoje), depois `ultima_distribuicao_at`.
- Somente leitura: nenhuma mudança foi feita.
