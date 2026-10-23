# Financeiro: parcelas das intermediações no "A receber"

## O que encontrei
- **"A receber" está vazio porque nenhuma parcela foi criada.** As parcelas existem dentro das intermediações, mas não foram passadas para o controle de recebimentos do Financeiro, que tem 0 parcelas.
- **Parcelas nas intermediações ativas:** 108 no total.
  - 22 com vencimento de hoje em diante, somando cerca de R$ 146,7 mil, em 10 intermediações.
  - 86 com vencimento já passado, somando cerca de R$ 1,08 milhão. Não sabemos quais foram pagas.
- **Ligação entre vendas e intermediações:** das 115 vendas ganhas, 37 estão ligadas a uma intermediação. Das 62 intermediações ativas, várias ainda não estão ligadas a nenhuma venda.
  - Com parcela futura e sem ligação: Fabricio Nogueira Mello (The Arch 204), Rafael de Andrade Carvalho (The Arch 917), Clarissa Bochanowski (Alto Lindóia 411A), entre outras.
  - Já ligadas: Andressa (Alto Lindóia 509C), Juliana Battisti (Connect JW 321) e Henrique Lohse (Casa Bastián).

## O que vou fazer
1. **Ligar as intermediações certas às vendas:** só ligo quando cliente, empreendimento e unidade batem com uma venda ganha, sem outra venda candidata. As que ficarem em dúvida vão para uma lista, para você decidir. Nada de valor ou divisão é alterado.
2. **Parcelas futuras no "A receber":** toda parcela com vencimento de hoje em diante, de intermediação ligada a uma venda, passa a aparecer no "A receber". Ela entra como "a receber", com o número da parcela, o vencimento, o valor e a forma de pagamento da intermediação.
3. **Parcelas vencidas ficam fora por enquanto:** nenhuma entra como paga nem como vencida.
4. **Planilha para você conferir:** gero uma planilha com todas as vendas, mostrando venda, cliente, empreendimento, unidade, intermediação ligada, cada parcela com vencimento e valor, e uma coluna "Paga? (sim/não)" para você preencher.
   - Quando você me devolver, as marcadas "não" entram no "A receber" como vencidas.
   - As marcadas "sim" entram como recebidas. Se não tiver comprovante, fica anotado "Confirmado pelo CEO".
5. **Daqui para frente:** quando uma intermediação for ligada a uma venda (no "Resolver", na confirmação da venda ou ao gerar uma nova), as parcelas futuras dela vão automaticamente para o "A receber". Isso não acontece se a parcela já existir, para não duplicar.
6. **Validação de ponta a ponta:**
   - Abrir o Financeiro como CEO e conferir que o total do "A receber" bate com a soma das parcelas futuras das intermediações ligadas.
   - Abrir uma venda e ver as parcelas nos detalhes.
   - Testar "Receber" num cliente de teste, que é apagado no final.
   - Conferir que as 115 vendas e o VGV não mudaram.

## Detalhes técnicos
- **Criar as parcelas:**
  - As parcelas vêm de `intermediacoes.parcelas` (jsonb `[{valor, vencimento}]`), vão para `negocios_recebimentos` com status pendente e `parcela_num` = posição na lista.
  - Só entram parcelas com `vencimento >= hoje (BRT)` e `negocios.intermediacao_id` = intermediação ativa.
  - Idempotência pela chave `(negocio_id, intermediacao_id, parcela_num)`.
  - Lançamento inicial feito por SQL de dados, com registro em `financeiro_historico`.
- **Daqui para frente:** uma função `financeiro_gerar_parcelas_intermediacao(negocio_id)` com SECURITY DEFINER, sem presumir pagamento, chamada por `anexar_documentos_venda` e `confirmar_venda` depois que a intermediação é ligada. É uma migration só. Antes de criar, verifico se `confirmar_venda` já faz algo parecido para reutilizar.
- **Ligar intermediações às vendas:** usa a mesma normalização de `chaveEmpreendimento`, mais unidade e nome. O resultado sai numa planilha com as colunas "ligadas" e "dúvidas".
- **Planilha de conferência:** `/mnt/documents/conferencia-parcelas-2026-10-23.xlsx`.
- Regras mantidas: o recibo de NF não significa que o repasse foi pago; nenhum recebimento é presumido.
