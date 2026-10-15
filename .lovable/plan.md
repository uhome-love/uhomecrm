# Minha Rotina: "Minha evolução" = Leads, Visitas e Vendas do mês

## Ideia
- **Roleta (topo):** responde "posso entrar hoje?". Ficam os 3 cartões ✓/✗ (Saúde do CRM, visitas da semana passada, descartes). As bolinhas verde/amarelo/vermelho do Pipeline vão para dentro do cartão Saúde do CRM. A saúde aparece só aqui.
- **Minha evolução:** responde "como estou indo no mês?", com 3 números do mês e a comparação com o mês anterior.

```text
MINHA EVOLUÇÃO · OUTUBRO
+------------------+------------------+------------------+
| LEADS            | VISITAS          | VENDAS           |
| 24               | 3 realizadas     | 1                |
| +4 vs setembro   | -2 vs setembro   | R$ 450 mil VGV   |
+------------------+------------------+------------------+
Faixa fina: "Esta semana: 0 de 2 visitas — faltam 2 para a Roleta de seg 20/10"
            "Situação: Plano de retomada — seu gerente vai fazer um 1:1"
```

- **Leads:** leads recebidos no mês.
- **Visitas:** visitas realizadas no mês, pela definição oficial de visita.
- **Vendas:** vendas assinadas no mês, com o VGV pela regra oficial (parceria 50/50).
- A meta da semana (X de 2) e a situação (Apto / Em evolução / Plano de retomada) viram uma faixa fina embaixo, em vez de cartões grandes.
- Sai o cartão "Visitas desta semana", que repetia o credenciamento.

## Validação
- Conferir no banco os números da Rafaela (leads, visitas e vendas do mês) contra a tela.
- Ver o alinhamento em tamanho de computador.

## Detalhes técnicos
- `RoletaTurnoCard`: o cartão Saúde do CRM recebe as bolinhas (`SaudeLinks`).
- `MinhaEvolucaoKpis`: novo hook `useMinhaEvolucaoMes` com mês atual e anterior em BRT. Leads = `pipeline_leads` do corretor pela data de distribuição; visitas = `roleta_visitas_realizadas_periodo`; vendas/VGV = mesma fonte dos relatórios (ganho + data_assinatura BRT, rateio de parceria).
- Faixa com semana e situação a partir de `useMinhaEvolucao`.
- Só tela. Nenhuma regra muda.
