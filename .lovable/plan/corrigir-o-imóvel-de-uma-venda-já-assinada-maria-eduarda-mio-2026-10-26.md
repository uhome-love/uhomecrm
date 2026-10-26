# Corrigir o imóvel de uma venda já assinada (Maria Eduarda Mioranza)

## O que encontrei
- A venda foi confirmada como Ganho em 25/10 com o empreendimento **Casa Tua Porto Alegre**, construtora Encorp, unidade 505, R$ 215.000.
- A intermediação dela diz **MedPlex Eixo Norte, unidade 505**. Então o certo é MedPlex.
- O "MEDPLEX" que aparece escrito no lado esquerdo foi salvo só no cliente, não na venda. Por isso o quadro do negócio continua mostrando Casa Tua.
- MedPlex não existe no cadastro oficial de empreendimentos.
- Venda assinada só pode ser corrigida pelo CEO ou pela diretora, na página Vendas (regra do Financeiro). Hoje essa correção só aceita empreendimentos já cadastrados, então não dá para escolher MedPlex.

## O que muda
1. **Na correção da venda (página Vendas):** o campo Empreendimento passa a ter a mesma busca da confirmação da venda. Ela mostra cadastrados ativos e inativos e tem o botão "Adicionar imóvel ou empreendimento". O que for criado fica fora da Roleta, do Foco e dos anúncios.
2. **Na aba Negócio do cliente:** para CEO e diretora, quando a venda está assinada, aparece o botão **"Corrigir venda"**, que abre a mesma correção sem precisar ir até Vendas. Para gerentes e corretores, nada muda: eles continuam sem poder alterar venda assinada.
3. Toda correção continua registrada no histórico do Financeiro (antes e depois).
4. **Maria Eduarda:** depois de pronto, eu corrijo a venda para MedPlex Eixo Norte, unidade 505, se você autorizar, ou você mesmo corrige pelo botão novo. A construtora do MedPlex precisa ser informada. Qual é?

## Validação
- Com um cliente de teste em Ganho: abrir "Corrigir venda", criar um empreendimento novo, salvar, conferir o nome novo no negócio, em Vendas e no histórico. Depois, apagar o teste.
- Conferir que um gerente não vê o botão.
- Conferir que o VGV total de Vendas não muda.

## Detalhes técnicos
- `EditarVendaDrawer.tsx`: trocar o `Select` por `EmpreendimentoVendaPicker`, que usa `criar_empreendimento_venda`.
- Novo botão na aba Negócio do detalhe do lead (`isAdmin || isDiretor`, fase ganho), abrindo o `EditarVendaDrawer` com o negócio atual.
- `editar_venda` hoje exige empreendimento com construtora. Ele já aceita inativos, então não precisa de migration.
