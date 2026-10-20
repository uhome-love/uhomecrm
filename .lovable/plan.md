# Correção: "Aproveitar" do Bolsão não levou Fabi Machado ao pipeline do William

## O que aconteceu (verificado)
- William puxou a Fabi Machado (Lake Eyre) pela porta Estagnados às 17:09. O cliente ficou reservado para ele só até 17:14 (prazo de 5 minutos).
- O "Aproveitar" nunca chegou a ser gravado: a reserva continua sem resultado e o lead segue arquivado em Qualificação, com o corretor antigo.
- A explicação mais provável: ele falou com a cliente por mais de 5 minutos e clicou em Aproveitar depois do prazo. O sistema recusou ("reserva expirada"), mas a tela mostrou uma mensagem genérica, "Não foi possível aproveitar", e fechou o cliente. Por isso ele achou que tinha dado certo.
- O fluxo em si funciona: hoje às 17:12 outro corretor aproveitou o Rafael Vasconcelos, que entrou normalmente em Novo Lead.

## O que vou corrigir
1. **A reserva não vence enquanto o cliente está aberto na tela.** Com o cliente aberto, a reserva é renovada sozinha a cada 2 minutos. Se a pessoa fechar a tela, o prazo volta a correr.
2. **Aproveitar mesmo com o prazo vencido**, desde que ninguém mais tenha puxado esse cliente e ele continue podendo entrar no Bolsão. Se outro corretor já tiver puxado, o sistema recusa com aviso claro.
3. **Mensagens claras**: a tela passa a mostrar o motivo real ("reserva expirou e outro corretor pegou", "telefone ativo com outro corretor" etc.). Se der erro, o cliente continua aberto, com a opção de tentar de novo.
4. **Registro de falhas**: toda recusa ou erro do Aproveitar fica registrado, para conferirmos casos como este sem depender de print.
5. **Fabi Machado**: depois da correção, coloco a Fabi no pipeline do William, em Novo Lead, pelo mesmo caminho oficial (histórico antigo oculto para ele e visível para a gestão).

## Validação ponta a ponta
- Com um lead de teste: puxar, esperar o prazo vencer e aproveitar (tem que entrar em Novo Lead). Depois, testar o caso em que outro corretor já puxou (tem que recusar com a mensagem certa). Conferir também que Não atendeu e Sem interesse continuam iguais.
- Conferir a Fabi no pipeline do William em Novo Lead, aguardando aceite.
- No fim, apagar o lead de teste e as reservas e o histórico dele.

## Detalhes técnicos
- `BolsaoDiscador.tsx`: renovação a cada 2 minutos via nova ação `renovar` em `bolsao_registrar` (estende `reservado_ate` só para o dono da reserva). Ler o corpo da resposta 409 do `functions.invoke` (hoje `data` vem nulo e cai na mensagem genérica). Em caso de erro, não chamar `setLead(null)`.
- `bolsao-aproveitar`: se a reserva for do próprio corretor e estiver vencida, aceitar quando não houver reserva ativa de outro corretor e o lead ainda constar em `bolsao_elegiveis`; senão, devolver `RESERVA_DE_OUTRO`/`NAO_ELEGIVEL`. Gravar em `ops_events` toda recusa ou erro.
- 1 migration (só a função `bolsao_registrar` com o novo resultado `renovar`), fora do horário de pico, se necessário.
- Fabi (`723f8fa8…`): reativada com `reactivateLead` para o William (auth `2a37e6a8…`, perfil `53eeb9e4…`), marcando `reaproveitado_em`.
