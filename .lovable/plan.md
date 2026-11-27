# Enviar o Matheus Beck (Alfa) para a Fila CEO

## O que aconteceu
- O novo interesse do Matheus Beck no Alfa chegou hoje às 00h56.
- A regra "estagnado com novo interesse vai para a Fila CEO" só entrou no ar à tarde.
- A regra vale para entradas novas; ela não volta no tempo. Por isso ele continuou com a Rafaela Sandin.

## O que será feito (só nesse lead)
1. Tirar o lead da Rafaela Sandin e deixar sem corretor, como Novo Lead na Fila CEO.
2. Gravar no histórico o novo interesse completo no Alfa, como num lead novo, e uma anotação: "Enviado para a Fila CEO por novo interesse com lead estagnado".
3. Não avisar a Rafaela.
4. Não distribuir automaticamente: a Fila CEO continua sendo distribuída à mão.

## O que não muda
- Nenhuma regra, código ou outro lead.

## Conferência
- Confirmar no banco que ele está sem corretor, em Novo Lead, e aparece na Fila CEO.

## Detalhes técnicos
- Atualização de dados no lead fa550f17 em uma transação, reaproveitando o mesmo formato de reativação usado por `_shared/reactivateDiscardedToRoleta.ts` (corretor_id nulo, etapa Novo Lead, reativado_em = agora, atividade "Novo interesse").
