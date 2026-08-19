# Correção do Relatório Flow (versão para a incorporadora)

Duas correções pontuais no relatório já gerado. Nenhuma alteração no CRM, no banco ou no app — só os arquivos do relatório.

## 1. Tirar a venda que não é do Flow

A venda assinada de R$ 370.000 (Rafael Andrade, 04/08/2026) está registrada no CRM com o empreendimento **The Arch**, não Flow. O lead entrou pela campanha do Flow, mas fechou outro produto — então não pode ser apresentado como venda do Flow.

O que muda:
- Negócios: de **8** para **7** (todos em negociação, nenhum assinado)
- VGV: de **R$ 1.508.000** para **R$ 1.138.000** (soma dos negócios do Flow em negociação)
- Vendas assinadas: de **1** para **0**
- Nota de rodapé (opcional, se você quiser manter transparência): "1 lead originado da campanha do Flow fechou negócio em outro empreendimento do portfólio" — só incluo se você aprovar; por padrão fica fora.

## 2. Ajustar o CPL para R$ 35

O CPL de R$ 21,98 vinha só das 2 campanhas de jul–ago lançadas no CRM (R$ 3.517,33), que não cobrem toda a verba. Passa a usar o CPL real informado: **R$ 35 por lead**.

- Custo por lead: **R$ 35,00**
- Investimento total estimado: **R$ 5.600,00** (160 leads × R$ 35)
- Custo por visita realizada: **R$ 373,33** (R$ 5.600 ÷ 15 visitas realizadas)
- O texto passa a dizer "investimento de mídia informado" em vez de "lançado no CRM", já que o valor não sai do CRM.

## O que continua igual

160 leads · 142 contatados (89%) · 949 atividades · 14 corretores · 95 leads em reengajamento (156 disparos, 31 respostas, 13 reativados) · 31 visitas totais · 15 realizadas.

## Entregáveis

- `relatorio-flow-v2.md` — documento revisado para o Claude montar a apresentação
- `relatorio-flow-v2.xlsx` — mesmas 13 abas, com "Resumo", "Mídia" e "Negócios" corrigidas (a linha da venda The Arch sai da aba Negócios)

Os arquivos originais ficam preservados.
