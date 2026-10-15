# Minha Rotina: separar "Roleta de hoje" de "Minha evolução"

## Ideia
Cada quadro responde a uma pergunta diferente, sem repetir número:

- **Roleta (topo):** "Posso entrar hoje?" Mostra os 3 cartões ✓/✗ (Saúde do CRM, visitas da semana passada, descartes). A Saúde do CRM fica só aqui, já com as 3 bolinhas do Pipeline (verde/amarelo/vermelho) dentro do cartão.
- **Minha evolução:** "Como estou indo no mês?" Sai a Saúde do CRM, que já aparece na Roleta. A semana atual vira o caminho para a próxima Roleta, e entram números de resultado.

```text
MINHA EVOLUÇÃO
+----------------------+----------------------+----------------------+
| PRÓXIMA SEMANA       | VISITAS NO MÊS       | VENDAS NO MÊS        |
| 0 de 2 visitas       | 3 realizadas         | 1 venda              |
| [barra]              | outubro              | R$ 450 mil de VGV    |
| Faltam 2 para estar  | +1 vs setembro       |                      |
| liberado seg 20/10   |                      |                      |
+----------------------+----------------------+----------------------+
Faixa fina abaixo: "Situação: Plano de retomada — seu gerente vai fazer um 1:1"
```

- **Próxima semana:** as visitas desta semana, apresentadas como meta para a próxima Roleta (a semana passada fica no cartão de cima, então os números não se repetem).
- **Visitas no mês:** total de visitas realizadas no mês, comparado com o mês anterior.
- **Vendas no mês:** quantidade e VGV assinados no mês, pela regra oficial de VGV (parceria 50/50).
- **Situação** (Apto / Em evolução / Plano de retomada) vira uma faixa fina com a frase, e não um cartão grande.

## Validação
- Conferir os números da Rafaela no banco (visitas do mês, vendas do mês) contra a tela.
- Ver o alinhamento em tamanho de computador.

## Detalhes técnicos
- `RoletaTurnoCard`: o cartão "Saúde do CRM" recebe as bolinhas (`SaudeLinks`).
- `MinhaEvolucaoKpis`: sai o cartão de saúde; entram "Próxima semana" (dados atuais de `useMinhaEvolucao`), "Visitas no mês" (`roleta_visitas_realizadas_periodo` com o mês atual e o anterior, em BRT) e "Vendas no mês" (mesma fonte de VGV usada nos relatórios: ganho + data_assinatura BRT, com rateio de parceria). Situação vira uma faixa.
- Só tela. Nenhuma regra de Roleta muda.
