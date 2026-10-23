# Intermediação: opções de forma de pagamento não aparecem

## O que encontrei
- No ambiente de testes, o bloco **"2. Forma de pagamento (obrigatória)"** aparece com as 3 opções (ZemoBank, Nota fiscal, PIX), logo abaixo de "Comissão" e acima de "Testemunhas". Conferi abrindo a página.
- O sistema que gera o documento já exige a forma de pagamento. Mas a versão publicada do CRM (a que os gerentes usam, uhomesales.com) ainda é anterior a esse bloco. Por isso a tela não mostra as opções e o botão "Gerar" é recusado com "Escolha a forma de pagamento".
- Isso explica o erro do Junior com a Cristina e o print que você mandou.
- O lugar da escolha também confunde: fica longe do botão, e o texto "2.1 — Escolha a forma de pagamento", lá embaixo, não deixa escolher nada.

## O que vou fazer
1. **Escolha perto do botão:** no rodapé, onde hoje aparece "2.1 — Escolha a forma de pagamento", colocar também os 3 botões (ZemoBank / Nota fiscal / PIX), ligados à mesma escolha do bloco 2.
2. **Ao clicar em Gerar sem escolher:** a tela rola até o bloco de forma de pagamento e o destaca em vermelho, além da mensagem.
3. **Publicar o CRM** para os gerentes receberem a versão com as opções. Esta etapa é sua: é só apertar o botão Publicar quando eu terminar.
4. **Validação:** gerar uma intermediação de teste escolhendo cada forma (ZemoBank, NF e PIX), conferir que sai certo e apagar o teste. Testar também clicar em Gerar sem escolher.

## Detalhes técnicos
- `FormaPagamentoCard` ganha `id`/ref e estado de erro; `IntermediacaoPage.handleGerar` faz `scrollIntoView` quando falta a forma.
- Seletor compacto reaproveita `FORMAS_PAGAMENTO` no bloco 2.1 da pré-visualização.
- Nenhuma mudança no servidor nem nos dados.
