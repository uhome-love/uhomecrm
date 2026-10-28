# Empreendimento novo na Documentação/Proposta/Contrato

## O que encontrei
- A tela da foto (Documentação do Andre Luiz) é a versão antiga, que ainda está no site publicado: campo "Empreendimento" só com a lista fixa e a construtora embaixo.
- Na versão de teste a correção de 24–25/10 já existe: o campo virou "Empreendimento ou imóvel", com busca e o botão "Adicionar imóvel ou empreendimento" no fim da lista (empreendimento novo ou imóvel avulso, com nome e construtora). O item criado fica só para vendas: não entra na Roleta, no Foco nem nos anúncios.

## O que fazer
1. Abrir no teste a Documentação de um lead de teste e confirmar que aparece "Adicionar imóvel ou empreendimento", cadastrar um nome novo, ver que ele fica selecionado e depois Cancelar, sem salvar.
2. Fazer o mesmo em Proposta e Contrato.
3. Se estiver tudo certo, você publica e o time passa a ver o botão no site oficial.
4. Se algo falhar no teste, eu corrijo antes de publicar.

## Detalhes técnicos
- Componente: `EmpreendimentoVendaPicker`, usado em `PropostaCampos`, que fica dentro de `JornadaNegocioForm` e usa a função `criar_empreendimento_venda`.
- Não precisa mudar banco nem regras.
