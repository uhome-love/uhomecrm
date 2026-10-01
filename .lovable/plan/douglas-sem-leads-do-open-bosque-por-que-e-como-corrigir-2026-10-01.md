# Douglas sem leads do Open Bosque: por que e como corrigir

## Causa (verificado)
- A roleta manda primeiro para quem recebeu **menos** Open Bosque no turno. Ela conta pelo registro de envios da roleta.
- Os 19 leads que saíram do Douglas voltaram para a fila, mas os 19 registros de envio continuam no nome dele, marcados como "aceito" (14:21).
- Para a roleta, o Douglas está com **19** neste turno. Os outros estão com 4 ou 5 (Wendel 5, os demais 4). Por isso ele fica sempre por último e não recebeu nenhum.
- Ele não está bloqueado: continua apto e ativo na roleta.
- Sem correção, ele volta a receber no turno da noite, quando o contador zera, ou quando os outros passarem de 19 cada.

## O que será feito
1. Apagar os 19 registros de envio do repasse que foi desfeito (só os do Douglas, Open Bosque, hoje às 14:21). Os leads em si e os registros "Repasse desfeito" na linha do tempo não mudam.
2. Com isso, o Douglas fica com 0 Open Bosque no turno e passa a ser o primeiro da fila. Ele recebe os próximos até alcançar os outros (cerca de 4 ou 5) e depois o rodízio volta a ser igual para todos.
3. Não muda nenhuma regra da roleta e nada dos outros corretores.

## Validação
- Contar de novo os envios de hoje: Douglas com 0, os demais iguais.
- No próximo lead do Open Bosque, conferir que ele foi para o Douglas.

## Detalhes técnicos
- Só update de dados (sem migration): `delete from roleta_distribuicoes` onde `corretor_id` = profile do Douglas, `enviado_em` entre 17:21:33 e 17:21:51 UTC de 01/10 e `lead_id` nos 19 leads do Open Bosque (`6ade58aa…`). Conferir antes que são exatamente 19 linhas.
- `distribuir_lead_atomico` não é alterada. A contagem `recebidos_no_produto` usa essa tabela.
