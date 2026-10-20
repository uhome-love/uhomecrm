# Bolsão igual às Listas da Oferta Ativa

## Como funciona hoje nas Listas (verificado)
- Ao puxar um cliente, ele fica "em atendimento" com o corretor por 5 minutos. Isso serve **só para outro corretor não puxar o mesmo cliente ao mesmo tempo**.
- O corretor pode registrar qualquer resultado, inclusive "Aproveitado", **a qualquer momento enquanto o cliente estiver na tela**, mesmo depois dos 5 minutos. Nada é recusado por tempo.
- Quando ele registra o resultado e passa para o próximo, o cliente sai da tela dele.

## Como vai ficar no Bolsão (mesma regra)
- Puxou, o cliente aparece na tela. Os 5 minutos servem só para ninguém mais puxar o mesmo cliente.
- Ele pode clicar em Aproveitar, Não atendeu ou Sem interesse a qualquer momento enquanto o cliente estiver na tela, sem limite de tempo e sem relógio na tela.
- Passou para o próximo, o cliente anterior sai da tela e não tem mais botão para ele.
- Raro: se o tempo passou e outro corretor puxou esse mesmo cliente nesse meio-tempo, quem puxou por último fica com ele, e o primeiro recebe um aviso claro.

## O que muda em relação ao que já está no ar
- O Aproveitar já funciona após os 5 minutos (correção de hoje). Agora **Não atendeu e Sem interesse** passam a funcionar igual; hoje eles ainda dão "reserva expirou".
- A renovação automática a cada 2 minutos sai, porque as Listas não têm isso e não precisa.
- O texto "Reservado para você até HH:mm" sai da tela.

## Validação
- Com um lead de teste:
  - Puxar, esperar mais de 5 minutos e testar cada botão: Aproveitar (tem que ir para Novo Lead), Não atendeu (tem que voltar amanhã) e Sem interesse (tem que virar definitivo).
  - Testar o caso de outro corretor puxar no meio: tem que aparecer o aviso.
- Ao final, apagar o lead de teste.

## Detalhes técnicos
- `bolsao_registrar`: aceitar o resultado quando a reserva for do próprio corretor, mesmo vencida, desde que não exista reserva ativa de outro corretor. Exige 1 migration, feita após 19h BRT conforme a regra.
- `bolsao-aproveitar`: manter a regra atual (dono, mesmo vencida, sem outra reserva ativa); remover a ação `renovar`; redeploy.
- `BolsaoDiscador.tsx`: remover o intervalo de renovação e o texto de prazo; manter as mensagens claras.
- `roadmap.md`: registrar a tarefa ao iniciar.
