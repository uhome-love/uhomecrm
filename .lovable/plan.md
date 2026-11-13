# Corrigir "Buscando o próximo cliente…" travado na Oferta Ativa (Estagnados)

## O que encontrei
- Hoje o Roni pegou 1 estagnado às 17:57 e só gravou o resultado (Aproveitado) às 18:17. Depois disso nenhum outro cliente foi reservado para ele — ou seja, o pedido do próximo cliente não chegou a acontecer ou falhou sem aviso.
- Na tela de ligação, o círculo "Buscando o próximo cliente…" aparece sempre que **não há cliente na tela e a fila não foi marcada como vazia**. Isso inclui casos em que nada está sendo buscado:
  - quando a gravação falha ("outro corretor já pegou", "já aproveitado") o cliente some da tela, mas o próximo nunca é pedido;
  - quando a busca dá erro, só aparece um aviso rápido e o círculo fica girando para sempre, sem botão.
- No celular, ao voltar do discador, a conexão às vezes está "dormindo"; a busca pode ficar pendurada sem resposta e sem limite de tempo.
- Não consegui confirmar qual dos casos aconteceu com o Roni (o celular dele não deixa registro de erro aqui). A correção cobre os três.

## O que vou mudar (só a tela de ligação, sem mexer em regras do Bolsão)
1. O círculo só aparece enquanto realmente está buscando.
2. Se a busca falhar ou demorar mais de 15 segundos: mostrar "Não consegui carregar o próximo cliente" com botões **Tentar de novo** e **Escolher outra fila**.
3. Quando a gravação recusar porque outro corretor pegou o cliente, buscar o próximo automaticamente.
4. Ao voltar para o app (celular), se a tela estiver sem cliente e parada, buscar de novo sozinha uma vez.
5. Garantir que uma busca atrasada não sobrescreva outra mais nova.

## Validação
- Testar com lead de teste nas filas Estagnados, Descartados e Listas, no computador e no celular (390px): resultado normal, falha simulada, demora simulada e volta do app.
- Apagar dados de teste ao final.

## Detalhes técnicos
- `useFilaOA.ts`: novo estado `erro`; `proximo()` com timeout (Promise.race 15s), contador de requisição para ignorar respostas antigas; nos ramos `setCliente(null)` de `registrar` chamar `proximo()`.
- `TelaLigacao.tsx`: condição do placeholder vira `carregando ? spinner : erro ? bloco de erro : vazio ? fila vazia : spinner+auto-retry`; listener `visibilitychange` que chama `proximo()` quando visível, sem cliente e sem carregar.
- Nenhuma mudança em `bolsao_puxar`/`bolsao_registrar`/`oa_aproveitar`.
