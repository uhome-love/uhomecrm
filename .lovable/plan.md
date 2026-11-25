# Pós-venda financeiro: o que a Uhome tem para receber

## Objetivo
Uma tela simples, só para CEO/diretora, que mostra venda por venda: parcelas futuras, o que já entrou (com check) e a parte da Uhome. Open = valor todo da Uhome (divisão interna fica fora do CRM).

## Fluxo ponta a ponta
```text
Venda entra → Intermediação gerada → Assinou (Ganho) → Parcelas criadas sozinhas
→ Financeiro "Pós-venda" → CEO dá check ao receber → totais atualizam
```

## Auditoria feita hoje (25/11)
- 132 vendas ganhas ativas; só 55 têm intermediação valendo. **77 vendas sem intermediação.**
- Nenhuma venda tem duas intermediações valendo (regra "uma por venda" ok hoje, mas sem trava no banco).
- 80 intermediações valendo: 26 do histórico (Drive) e 54 do sistema; **23 do sistema não estão ligadas a nenhuma venda** e 36 estão sem valor da Uhome calculado.
- **57 intermediações valendo sem parcelas** — por isso hoje "A receber" mostra só parte (R$ 427 mil de 32 + 7).
- 3 com soma das parcelas diferente do valor da intermediação.
- 2 parcelas presas em intermediações substituídas (R$ 66 mil) somando por engano.
- Nenhuma parcela marcada como recebida: o que já entrou ainda não está registrado.

## Fases (uma por vez, cada uma validada antes da próxima)
0. **Desenho** da tela no computador e no celular para aprovação do Lucas (regra obrigatória).
1. **Conferência ponta a ponta** (planilha para o Lucas, venda por venda): intermediação valendo, parcelas, valor total, parte Uhome, e coluna "já recebemos? quando?". Inclui as 77 vendas sem intermediação, as 23 soltas, as 57 sem parcelas e as 3 divergentes. Lucas marca o que já entrou; nada é apagado.
1b. **Correção dos dados aprovada**: ligar intermediações às vendas, gerar parcelas que faltam, tirar as parcelas das substituídas, registrar os recebimentos confirmados (com auditoria).
1c. **Trava no banco**: no máximo 1 intermediação valendo por venda; ao trocar, a anterior vira substituída e suas parcelas em aberto são canceladas.
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
