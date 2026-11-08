# Roleta de domingo: a visita feita no domingo conta para a semana atual

## O que acontece hoje
- A regra de domingo conta só as visitas realizadas de **segunda a sábado** (02 a 07/11). O Roni teve 1 nesse período (05/11), então aparece "Não elegível · domingo".
- A visita realizada **hoje, domingo 08/11**, fica fora da conta. Por isso o cartão mostra "Esta semana 2/2", mas o aviso continua dizendo que ele não é elegível.

## Mudança (regra decidida por você)
1. A semana passa a ser de **segunda a domingo, incluindo hoje**. Visita realizada no domingo conta para a semana atual e libera o domingo assim que é registrada.
2. Assim que a 2ª visita for registrada, o aviso muda para elegível. No caso do Roni, as visitas de 05/11 e 08/11 somam 2.
3. O cartão Visitas e o aviso passam a usar a mesma contagem e o mesmo período. Isso acaba com o "0 sem. passada" ao lado de "2/2".
4. A distribuição de leads, as outras regras e a inclusão manual continuam iguais.

## Ordem
Plano aprovado → construção → conferência ao vivo na tela do Roni → testes com casos de sábado e domingo.

## Detalhes técnicos
- Em `elegivel_roleta_domingo`, mudar a janela de `seg..sáb` para `seg..domingo` (p_domingo inclusive). Para contar as visitas, usar a fonte canônica `roleta_visitas_realizadas_periodo`, com 0,5 por parceria e 1 por cliente, em vez de contar direto em `visitas`.
- Conferir `roleta_apto_janela` e o painel de credenciamento para que usem a mesma janela. Também verificar se o fechamento semanal (`roleta_fechar_semana`, segunda 00h05) já inclui o domingo.
- Será uma única migration de função (`CREATE OR REPLACE`), aplicada hoje, mais um ajuste no texto do cartão.
