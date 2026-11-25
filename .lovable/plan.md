# Pós-venda financeiro: o que a Uhome tem para receber

## Objetivo
Uma tela simples, só para CEO/diretora, que mostra venda por venda: parcelas futuras, o que já entrou (com check) e a parte da Uhome. Open = valor todo da Uhome (divisão interna fica fora do CRM).

## Fluxo ponta a ponta
```text
Venda entra → Intermediação gerada → Assinou (Ganho) → Parcelas criadas sozinhas
→ Financeiro "Pós-venda" → CEO dá check ao receber → totais atualizam
```

## O que encontrei no banco hoje
- 32 intermediações ativas com parcelas (R$ 378 mil a receber: NF R$ 104 mil, PIX R$ 115 mil, Zemo R$ 158 mil).
- 50 intermediações ativas sem forma de pagamento; só 7 delas têm parcelas (R$ 49 mil). As outras 43 não aparecem em "A receber".
- Nenhuma parcela marcada como recebida até hoje.
- 2 intermediações "substituídas" ainda têm parcelas (R$ 66 mil) — precisam sair da conta para não somar em dobro.
- 7 aguardando conferência, 18 duplicadas (já fora da conta).

## Fases (uma por vez, cada uma validada antes da próxima)
0. **Desenho** da tela no computador e no celular para aprovação do Lucas (regra obrigatória).
1. **Conferência dos dados**: lista das 43 vendas sem parcelas e das 2 substituídas; Lucas decide o que vale. Nada é apagado.
2. **Regra da parte da Uhome**: Open = 100% do valor; demais = valor da intermediação menos o repasse dos corretores (beneficiários), já com desconto de NF de 10%. Teste automático para cada regra.
3. **Tela "Pós-venda"** (nova primeira aba do Financeiro):
   - Topo com 4 números: Total a receber · Recebido no mês · Vencido · Parte da Uhome a receber.
   - Lista venda por venda (cliente, empreendimento, corretor, data da assinatura, valor total, parte Uhome, barra de progresso recebido/total).
   - Abre a venda → parcelas com vencimento, valor, situação (a vencer / vencida / recebida) e botão de check (data + comprovante opcional). Desfazer check só CEO/diretora, com registro.
   - Filtros: mês de vencimento, forma de pagamento, situação.
4. **Celular** 390px conferido.
5. **Validação ao vivo** com uma venda de teste, depois apagada.

## Detalhes técnicos
- Fonte única: `intermediacoes` (status ativa) + `negocios_recebimentos` + `intermediacao_beneficiarios`; respeita regras existentes (`financeiro_gerar_parcelas_intermediacao`, transações auditadas, sem presumir pagamento).
- Nova função de leitura agregada no servidor por venda, restrita a admin/diretor; check via transação de recebimento já existente (estende se faltar desfazer).
- Excluir `substituida`, `duplicada`, distratos e `is_teste`.
- Componentes novos em `src/components/financeiro/posvenda/`, arquivos pequenos.
- No máximo 1 migration (fase 2/3), dentro da janela permitida.

## Fora deste plano
Divisão interna do valor Open, emissão de nota, cobrança automática de construtora.
