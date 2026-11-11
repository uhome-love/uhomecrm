# Lia não respondeu ao teste: causa e correção

## O que aconteceu (confirmado)
- Sua resposta "Sim, quero ver" chegou na Lia às 16:26 e ficou registrada.
- A Lia ficou calada porque o seu número tem uma marca antiga de **"número inexistente"**, criada em 24/06 quando um envio falhou. Essa marca não tem prazo para acabar, e a Lia trata o número como bloqueado.
- A Lia não avisou nada: ela só para em silêncio. Por isso a conversa também não aparece em Conversas.
- A mensagem de teste saiu porque o botão de teste não confere essa marca; a resposta confere.

## Risco para os clientes
- 6.072 números têm essa mesma marca permanente. Hoje, se qualquer um deles responder, a Lia também fica calada.
- Até agora só o seu número foi afetado, porque a Lia quase não conversou desde agosto.

## O que vou fazer
1. **Seu número:** apagar a marca antiga de "número inexistente" do final 7097.
2. **Regra para todos:** quando o cliente responde, isso prova que o número existe. A partir daí, marcas técnicas de falha de envio ("número inexistente" e limite da Meta) deixam de bloquear esse número. Pedidos de saída ("não quero mais contato") e "já comprei" continuam bloqueando sempre.
3. **Teste:** você aperta de novo um botão da mensagem (ou escreve "oi"). Eu confiro se a Lia responde só para você e se a conversa aparece em Conversas. A trava de teste continua ligada, então ninguém mais recebe nada.

## O que não muda
- Envio para os outros clientes, trava de teste, horário 9h–20h, Roleta e Fila CEO.

## Detalhes técnicos
- Causa: `meta_supressao` (codigo `undeliverable`, `suprimir_ate` nulo) faz `contato_bloqueado` = true; `lia-whatsapp` faz `continue` após `registrar_resposta_recuperacao` sem criar `lia_estado`.
- Migração: em `registrar_resposta_recuperacao`, quando `acao='seguir'`, apagar ou expirar linhas do mesmo `telefone_last8` com códigos técnicos (`undeliverable`, `throttle_131049`, `experiment_130472`, código vazio); manter `opt_out`, `opt_out_global`, `ja_comprou`. Mesma migração remove a linha do final 92597097.
- Registrar um aviso no log quando a Lia deixar de responder por bloqueio, para não ficar silencioso de novo.
- É uma mudança no banco em horário comercial; posso aplicar agora ou depois das 19h.
