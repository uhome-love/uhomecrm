# Reserva do Bolsão: 15 minutos, mais as proteções que já estão no ar

## O que já foi feito
- Enquanto o cliente está aberto na tela, a reserva se renova sozinha.
- Se o prazo vencer e ninguém mais tiver puxado o cliente, o corretor ainda consegue aproveitar.
- A mensagem de erro agora diz o motivo, e o cliente não some da tela por causa de uma falha passageira.

## O que muda agora
1. **Reserva inicial passa de 5 para 15 minutos**, tempo suficiente para ligação e WhatsApp. A renovação automática também estende para 15 minutos.
2. **Aviso na tela**: quando faltarem 3 minutos para o fim da reserva, aparece "Sua reserva vence em breve" com o botão "Continuar com este cliente", que renova por mais 15 minutos. Isso cobre o caso de o celular bloquear a tela e parar a renovação automática.
3. Ninguém pode segurar um cliente para sempre: sem a tela aberta e sem clicar em continuar, o cliente volta para a lista depois de 15 minutos.

## Validação
- Com um lead de teste: puxar e conferir a reserva de 15 minutos. Depois, simular um prazo perto do fim para ver o aviso e renovar. Por último, aproveitar e conferir que o cliente entrou em Novo Lead. Ao final, apagar o lead de teste.

## Detalhes técnicos
- Migration: recriar `bolsao_puxar` trocando `interval '5 minutes'` por `'15 minutes'` (2 ocorrências), sem outra mudança. Será feita fora do horário de pico (após 19h BRT), conforme a regra de migrations.
- `bolsao-aproveitar`: `RESERVA_MIN = 15`; redeploy.
- `BolsaoDiscador.tsx`: contador derivado de `reservado_ate`, que mostra o aviso quando faltam 3 minutos ou menos. O botão chama a ação `renovar` que já existe.
