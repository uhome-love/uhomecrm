# Luiza Clós na Roleta da tarde — o que aconteceu e correção

## O que foi verificado (hoje, 21/10)
- 17:00 — Luiza enviou o pedido de entrada na Roleta da tarde.
- 17:05 — o pedido foi **aprovado pela conta do Lucas** (aprovação manual na tela da Roleta).
- Visitas: ela cumpre a regra. Semana passada teve só 1 realizada, mas nesta semana já tem 2 (20/10 às 19h e 21/10 às 14h30).
- CRM: 84,6% em dia (44 de 52 ativos), acima do mínimo de 80%.
- Horário: o pedido da tarde só deveria abrir das 12:00 às 13:30. A tela da Roleta fecha o botão depois das 13:30, mas **o servidor não confere o horário**. Por isso um pedido feito às 17:00 foi aceito (tela aberta desde antes, por exemplo) e ficou esperando aprovação.

Resumo: ela cumpria visitas e CRM, mas pediu fora do horário. O sistema deixou o pedido passar e ele foi aprovado manualmente.

## Correção proposta
1. O servidor passa a recusar pedidos de entrada fora do horário de cada turno (horário de Brasília):
   - Manhã: 07:00 às 09:30
   - Tarde: 12:00 às 13:30
   - Noturna: 18:00 às 21:30
   - Domingo e feriado (dia todo): 08:00 às 23:30
   Mensagem para o corretor: "O credenciamento da tarde fecha às 13:30."
2. Pedidos pendentes fora do horário não aparecem mais para aprovação (ficam como recusados automaticamente ao abrir a tela de aprovação).
3. "Incluir manualmente na fila" pelo CEO continua funcionando a qualquer hora. É a exceção da gestão, e fica registrada com o nome de quem incluiu.
4. A entrada de hoje da Luiza não será alterada, a menos que você peça.

## Validação
- Simular pedido fora do horário com conta de teste: recusado com a mensagem.
- Pedido dentro do horário: segue normal para aprovação.
- Inclusão manual pelo CEO: continua funcionando.

## Detalhes técnicos
- Nova função `roleta_janela_cred_aberta(p_janela)` (BRT, domingo/feriado via `feriados`), chamada no início de `credenciar_por_alocacao` e `credenciar_na_roleta`; `aprovarCredenciamento` recusa pendentes cujo `created_at` caiu fora da janela.
- Migration só depois das 19h BRT (regra de migrations).
- `incluirManualNaFila` não muda.
