# Venda do Helton (Monjardin 204): por que não entra em Ganho

## O que encontrei
O cliente é **helton** (corretora Jéssica França, gerente Gabriel Vieira), na etapa **Contrato**. O sistema recusou 6 tentativas entre 13:38 e 13:42 com a mensagem "Confirme a venda com dados completos e anexos antes de mover para Ganho". Ou seja, a trava da venda funcionou, mas a venda não consegue ser confirmada por **3 dados quebrados** neste cliente:

1. **A intermediação está marcada como "duplicada".** O documento existe (HELTON NEGRELLO, Monjardin, unidade 204, VGV R$ 1.900.000, comissão R$ 66.500, Jéssica 34% e Gabriel 15%), criado em 19/10. Mas não existe outra intermediação ativa dele: esta é a única e não está ligada ao cliente nem ao negócio. Com isso, não aparece nenhuma intermediação para escolher na hora de confirmar a venda.
2. **O empreendimento Monjardin está desligado** no cadastro oficial (construtora ABF). Por isso ele não aparece na lista de empreendimentos do formulário de venda. Além disso, no cliente está escrito "Monjadim" (com erro de digitação) e sem vínculo ao cadastro oficial.
3. **O negócio do cliente está arquivado.** A unidade 204 e o VGV estimado de R$ 1,9 milhão estão certos, mas falta vínculo com o empreendimento oficial.

## O que vou fazer (só neste cliente, sem tocar em outras vendas)
1. **Religar o Monjardin** no cadastro oficial, porque é um produto real com venda.
2. **Corrigir o cliente e o negócio:** empreendimento oficial Monjardin (atualizando também a campanha para o nome não voltar errado) e negócio de volta para ativo, na fase Contrato.
3. **Reativar a intermediação** e ligá-la ao cliente e ao negócio. Ela fica aguardando a confirmação da venda, sem forma de pagamento escolhida e sem nenhum recebimento presumido. A forma de pagamento continua sendo escolhida pelo gerente.
4. **Verificar se o mesmo problema atinge outras vendas:** clientes em Contrato ou Em Negociação cujo empreendimento esteja desligado ou cuja única intermediação esteja marcada como duplicada. Só listo e te mostro, não altero nada.
5. **Explicar o erro na tela:** em vez de "erro ao mover lead", mostrar o motivo e abrir o formulário de confirmação da venda.

## O Gabriel ainda precisa fazer
Abrir o cliente, clicar em Ganho e preencher o formulário: data da assinatura, VGV final, intermediação (já vai aparecer) e **anexar o comprovante do ato**. Sem o comprovante a venda continua bloqueada, como combinamos.

## Como vou validar
- Entrar como o Gabriel no preview, abrir o formulário e conferir que o Monjardin e a intermediação aparecem. Clico em Cancelar e não confirmo a venda por ele.
- Conferir que as 115 vendas e o VGV total continuam os mesmos.

## Detalhes técnicos
- Lead `d21ad542…`, estágio Contrato `8c1eed68…`. Negócio `0ea73d57…` com status arquivado, `empreendimento_canonico_id` nulo e `intermediacao_id` nulo.
- Intermediação `6857016d…` com status duplicada, `negocio_id` e `pipeline_lead_id` nulos e `forma_pagamento` nulo.
- Canônico Monjardin `fc9fd5de…` com `ativo=false`.
- As correções de dados (passos 1 a 3) vão por UPDATE pontual, sem migration. Elas passam pelos guardas existentes; nada é gravado em `confirmar_venda`.
- O passo 5 é ajuste no front: mapear a mensagem do trigger para um toast claro e abrir `ConfirmarVendaForm` no caminho que hoje dá erro, depois de identificar se foi a troca de etapa pelo menu ou o arrastar.
