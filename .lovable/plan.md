# Intermediação: conferência da Cristina e ajustes na forma de pagamento

## O que conferi (Cristina Wiegand Zanetti, Essence, unidade A45)
- O sistema não ficou instável: as 2 tentativas das 17:18 deram certo e só 1 intermediação foi salva, sem duplicata. Ela está ligada ao negócio e ao cliente certo, com forma de pagamento ZemoBank.
- **Divergência importante:** a versão salva não bate com o print que você mandou.
  - No print: Pedro Jorge R$ 9.181,83 · **Junior Padilha R$ 4.303,99** · Gabrielle R$ 2.869,32 · Diretoria R$ 1.434,66 · UHome R$ 10.903,43 · total R$ 28.693,23.
  - Salvo: Pedro Jorge R$ 9.182,81 · **sem Junior** · Gabrielle R$ 2.869,63 · Diretoria R$ 1.434,81 · UHome R$ 15.209,03 · total R$ 28.696,28.
  - Ou seja, a comissão do gerente Junior (15%) não entrou no documento final e foi parar na UHome. O nome do arquivo cita "Gerente Junior Padilha", mas o quadro de divisão está sem ele.
- O empreendimento ficou gravado como "essence " (minúsculo e com espaço no fim) e a construtora como "abaco", digitados à mão, fora do cadastro oficial.

## O que vou fazer
1. **Descobrir por que o gerente sumiu:** reproduzir com um cliente de teste (adicionar gerente, escolher a forma de pagamento, gerar) e ver se a tela perde a comissão do gerente ao gerar ou ao trocar a forma de pagamento. Depois corrijo a causa.
2. **Intermediação da Cristina:** te mostro as duas versões e, com o seu ok (ou do Junior), refaço o documento com o gerente incluído e o empreendimento oficial "Essence". Até lá não mexo em nada.
3. **Escolha da forma de pagamento perto do botão:** repetir os 3 botões (ZemoBank / Nota fiscal / PIX) no rodapé. Se clicar em Gerar sem escolher, a tela rola até o bloco e destaca em vermelho.
4. **Empreendimento oficial:** ao gerar, o nome digitado é ajustado para o nome do cadastro oficial (sem espaços sobrando), e a construtora vem do cadastro.
5. **Validação:** gerar uma intermediação de teste com gerente em cada forma (ZemoBank, NF, PIX), conferir que o documento salvo bate com a pré-visualização da tela e apagar o teste.

## Detalhes técnicos
- Comparar `payload.gerentes` com o estado `gerentes` em `IntermediacaoPage.handleGerar` e a montagem dos beneficiários na edge `gerar-intermediacao` (`beneficiarios_validos` sem o papel gerente).
- `FormaPagamentoCard`: ref + estado de erro; seletor compacto no bloco 2.1.
- Normalizar o empreendimento pelo cadastro oficial (trim e nome canônico) no cliente e na edge.
