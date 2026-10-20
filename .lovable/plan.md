# Bolsão: sem prazo enquanto o cliente estiver na tela

## Regra nova
- Ao puxar um cliente, ele fica com o corretor **enquanto estiver aberto na tela dele**, sem contagem de tempo.
- Ele pode clicar em "Aproveitar" a qualquer momento, mesmo depois de uma ligação longa.
- Quando ele passa para o próximo (Não atendeu, Sem interesse, Pular, ou volta para a escolha das portas), o cliente sai da mão dele e **não pode mais ser aproveitado** por ele naquela hora.
- Nenhum outro corretor recebe esse cliente enquanto ele estiver na tela de alguém.

## Proteção para não prender cliente
- Se o corretor fechar o app ou o celular desligar com o cliente aberto, o cliente volta sozinho para a lista após 30 minutos sem sinal da tela. Esse é só um prazo de segurança, e ele não aparece para o corretor.
- Se ele voltar ao app antes disso, o mesmo cliente reaparece na tela para ele continuar.

## O que sai
- O texto "Reservado para você até HH:mm" sai da tela.

## Validação
- Com um lead de teste:
  - Puxar, esperar mais de 5 minutos e aproveitar: tem que entrar em Novo Lead.
  - Puxar, ir para o próximo e tentar aproveitar o anterior: tem que ser recusado.
  - Simular um corretor sumido: o cliente tem que voltar para a lista depois de 30 minutos.
- Conferir que Não atendeu e Sem interesse continuam iguais. Ao final, apagar o lead de teste.

## Detalhes técnicos
- `BolsaoDiscador.tsx`:
  - Sinal de "tela aberta" a cada 2 minutos pela ação `renovar`, que já existe; o sinal estende a reserva em 30 minutos.
  - Ao sair da tela ou trocar de cliente, chamar `liberar`.
  - Ao abrir o discador, retomar a reserva ativa do próprio corretor, se houver.
  - Remover o texto de prazo da tela.
- `bolsao-aproveitar`:
  - Aceitar apenas reserva ativa do próprio corretor.
  - Remover a regra de "aproveitar com reserva vencida", porque a regra nova é "só enquanto estiver na tela".
  - Renovar estende em 30 minutos.
- `bolsao_puxar`: reserva inicial de 30 minutos. Também retornar a reserva ativa existente do corretor, para retomar o mesmo cliente. Isso exige 1 migration, feita após 19h BRT conforme a regra.
- `roadmap.md`: registrar a tarefa ao iniciar a implementação.
