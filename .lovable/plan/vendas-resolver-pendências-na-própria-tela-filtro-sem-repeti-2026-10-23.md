# Vendas: resolver pendências na própria tela, filtro sem repetição e atalho de mês

## 1. Pendências só das vendas novas
- Vendas antigas saem da lista de pendências e deixam de mostrar o aviso "Pendentes" nos detalhes. Elas continuam valendo só pelo VGV, como você decidiu.
- Só entram nas pendências as vendas assinadas a partir de **22/10/2026**, quando começou a regra obrigatória. Hoje a lista mostra 115; com a mudança deve cair para poucas, como a da Juliana Battisti, que está sem o comprovante do ato.
- O indicador "Sem intermediação" no topo de Vendas passa a contar só essas vendas novas.

## 2. Resolver a pendência ali mesmo (só CEO e diretora)
O botão "Resolver" aparece em cada pendência e também nos detalhes da venda quando falta algum documento. Ele abre um painel com o que falta:
- **Intermediação:** escolher uma das intermediações cadastradas que ainda não estão ligadas a nenhuma venda. As que batem com o nome do cliente aparecem primeiro. Também tem o atalho "Gerar intermediação", que já existe.
- **Comprovante do ato:** anexar um PDF ou uma imagem de até 20 MB.
- **Empreendimento, unidade e VGV:** se faltarem, um botão leva para a edição da venda que já existe.

Ao salvar, a venda é atualizada, a pendência some e fica registrado no histórico quem anexou e quando. Nada muda no dinheiro: não gera recebimento, não muda a forma de pagamento e não refaz a divisão das comissões.

## 3. Filtro de empreendimento sem repetição
Empreendimentos com o mesmo nome aparecem uma vez só, mesmo com diferença de maiúsculas, acentos ou espaços. Exemplos: "Open Bosque" e "Open Bosque - v4", ou um cadastrado no sistema e outro digitado à mão. Ao escolher, entram todas as vendas desse empreendimento. Quando houver cadastro oficial, aparece o nome oficial.

## 4. Atalho de mês e ano nos filtros de data
Vai ficar ao lado dos campos "De" e "Até", em **Vendas** e no **Financeiro**:
- dois seletores, **Mês** (Janeiro a Dezembro, ou "Ano inteiro") e **Ano**;
- ao escolher, as datas são preenchidas sozinhas: do dia 1º ao último dia do mês, ou de 1º de janeiro a 31 de dezembro;
- os campos "De" e "Até" continuam funcionando para períodos livres.

## Validação
- Entrar como CEO, anexar o comprovante e escolher a intermediação numa venda de teste e conferir que a pendência some. Depois apagar a venda de teste, sem mexer em vendas reais.
- Conferir que o filtro de empreendimento não repete nomes e que os totais por empreendimento continuam iguais.
- Conferir que "Outubro de 2026" preenche de 01/10 a 31/10 em Vendas e no Financeiro.
- Conferir que as vendas e o VGV total continuam iguais.

## Detalhes técnicos
- **Corte de data:** a data de corte vira uma constante única em `src/lib/vendaConfirmacao.ts`, usada por `pendenciasVenda` e `documentosVenda`. A regra é `data_assinatura >= '2026-10-22'`, e o servidor não muda.
- **Nova função no banco (uma migration), `anexar_documentos_venda(p_id, p_intermediacao_id, p_comprovante_path)`:** SECURITY DEFINER, protegida por `financeiro_exigir_acesso()`. Ela exige venda ganha e ativa. A intermediação precisa estar ativa ou pendente de conferência e não pode estar ligada a outro negócio. A função grava `negocios.intermediacao_id` e `comprovante_ato_path`, liga a intermediação a `negocio_id` e `pipeline_lead_id`, e registra em `financeiro_historico` a ação `anexo_documentos`. Não mexe em beneficiários nem em recebimentos.
- **Upload:** o comprovante vai para o bucket `vendas-docs`, no caminho `negocio/<id>/<uuid>`. Se o salvamento falhar, o arquivo enviado é apagado.
- **Novo componente `ResolverPendenciaVenda.tsx`:** usado por `PendenciasVendas.tsx` e por `VendaDetalhes.tsx`.
- **Filtro:** em `VendasFiltros.tsx`, a chave do empreendimento passa a ser o nome normalizado (sem acento, minúsculo, sem sufixo " - vN"), e a filtragem compara pela mesma chave.
- **Novo componente `AtalhoMesAno.tsx`:** usado nos filtros de período de Vendas e do Financeiro, com datas no fuso de Brasília.
