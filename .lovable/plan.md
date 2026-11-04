# Negócios organizados ponta a ponta: fonte única do Pós-visita ao Ganho

## O que encontrei (conferido no sistema)
- **Etapas e fases não batem.** O Pipeline tem 5 etapas de negócio: Pós-Visita, Documentação, Em Negociação (proposta), Contrato e Ganho. A ficha do negócio só conhece 3 fases e hoje tem: em negociação 274, contrato 7, ganho 128. São duas réguas contando a mesma coisa.
- **A temperatura usa várias escalas.** O feedback da visita grava "Muito quente", mas o botão do Resumo só oferece Frio, Morno e Quente. Ele trata "Muito quente" como se já fosse "Quente", então clicar em Quente não faz nada. É o problema da sua foto. O topo do Resumo ainda usa outra escala, com Urgente e Gelado.
- **Temperatura e Interesse se repetem.** O Resumo pede Interesse Alto/Médio/Baixo e também Temperatura.
- **A situação do negócio está em três lugares:** na etapa, na aba Negócio e no texto da proposta. O Vitor está com "Cliente aprovado, vai gerar contrato" escrito, mas a situação continua "Proposta enviada".
- **O feedback da visita só aparece no histórico.** A aba Negócio não mostra nada dele.
- Entre os clientes de Visita até Contrato, 37 estão sem temperatura, 3 frios, 9 mornos, 4 quentes e 1 muito quente.

## 1. Régua única de etapas
A etapa do Pipeline manda e a ficha do negócio acompanha automaticamente.

| Etapa | Para entrar | Situação (escolher 1) | Para avançar |
|---|---|---|---|
| Pós-visita | Visita realizada com feedback | Pensando, Quer proposta, Aguardando família, Comparando | Temperatura e próximo passo |
| Documentação | Cliente interessado | Pendente, Enviada, Em análise, Aprovada, Reprovada | RG/CPF, renda e residência marcados |
| Proposta (Em Negociação) | Imóvel e unidade | Enviada, Contraproposta, Aprovada, Recusada | Valor e proposta aprovada |
| Contrato gerado | Proposta aprovada | Em confecção, Gerado, Em leitura, Assinatura marcada | Data prevista de assinatura |
| Ganho | Confirmação de venda atual (sem mudança) | — | Comprovante e intermediação, como hoje |

- É possível voltar uma etapa, por exemplo de proposta recusada para Pós-visita. A volta exige motivo e fica no histórico.
- O card do quadro de Negócios mostra a mesma coisa: etapa, situação, temperatura e próximo passo.

## 2. Termômetro do negócio (em todas as etapas até Contrato)
```text
+-------------------------------------------------+
| TERMÔMETRO DO NEGÓCIO          atualizado ontem |
| Temperatura: Frio | Morno | Quente | Muito quente |
| Situação:    Proposta aprovada                   |
| Próximo passo: Gerar contrato até 06/11          |
| Última visita: 01/11 · Quer proposta · Thalia    |
|   "Gerar contrato unidade 512 torre 2"           |
| Objeção: —                                       |
+-------------------------------------------------+
```
- **Uma escala só:** Frio, Morno, Quente e Muito quente, ou sem classificação. Dá para subir ou descer a qualquer momento: no Resumo, na aba Negócio, no feedback da visita e no card.
- Valores antigos são convertidos: Urgente vira Muito quente, e Gelado vira Frio.
- Cada troca fica no histórico, por exemplo "Muito quente → Morno · Gabriel".
- **O Interesse separado sai.** O valor antigo serve só para sugerir uma temperatura a quem ainda não tem.
- **O feedback pós-visita preenche o Termômetro:** resultado, temperatura, objeção e observação. Se a temperatura ficar em branco, a anterior é mantida.
- A observação vira **nota do negócio**, com data e autor.

## 3. Aba Negócio (mesma ordem em todas as etapas)
1. Termômetro
2. Imóvel, unidade e valor
3. Última visita e objeção
4. Parte da etapa atual: documentos, proposta ou contrato
5. Notas do negócio

## 4. Teste ponta a ponta
- Um cliente de teste chamado "TESTE Negócio Ponta a Ponta" passa pelas 5 etapas. Nele vou subir e descer a temperatura, trocar a situação, voltar uma etapa e chegar até a tela de Ganho, cancelando no final.
- A conferência é ao vivo, no computador e no celular, em quatro lugares: Resumo, aba Negócio, card do Pipeline e quadro de Negócios.
- Testes automáticos cobrem o que cada etapa exige para entrar e avançar, a escala de temperatura e a volta de etapa com motivo.
- No fim, o cliente de teste é arquivado. Isso não afeta números, Roleta ou VGV.

## Ideias extras (opcionais)
- **A.** Temperatura parada há mais de 7 dias em Negociação ou Contrato fica cinza, com o aviso "reclassificar".
- **B.** Próximo passo com data obrigatório em Negociação e Contrato, criando a tarefa automaticamente.
- **C.** Filtro "Negócios quentes" no Pipeline e no painel do gerente.
- **D.** Motivo rápido ao esfriar: Preço, Crédito, Desistiu ou Concorrente.

## Ordem de trabalho (padrão obrigatório)
1. Desenho da régua, do Termômetro e da aba Negócio, no computador e no celular, para sua aprovação.
2. Fase 0: régua única de etapas, sem alterar vendas ganhas.
3. Fase 1: escala única de temperatura. Isso corrige o caso do Vitor.
4. Fase 2: Termômetro e aba Negócio reorganizada.
5. Fase 3: feedback pós-visita ligado ao Termômetro.
6. Fase 4: teste ponta a ponta completo, mais as ideias extras que você aprovar.

## Fora deste plano
Roleta, distribuição, contagem de visitas, VGV, confirmação de venda, Financeiro e intermediação.

## Detalhes técnicos
- `negocios.fase` passa a ser derivada de `pipeline_stages.tipo` (pos_visita, documentacao, proposta, contrato_gerado, venda) via trigger. Registros `ganho` ficam intactos e o backfill só mexe nos ativos.
- `pipeline_leads.temperatura` fica restrita a `frio|morno|quente|muito_quente|null`. O backfill converte `urgente`, `gelado` e `nao_definida` pela ferramenta de dados, e um trigger valida os novos valores.
- O helper `src/lib/temperatura.ts` passa a servir TemperaturaChip, ResumoLead, VisitaResultadoDialog, CardMinimal, filtros e ordenação. TemperaturaChip vai comparar o valor real, e não mais o "tier".
- A situação usa `flag_status` por etapa via `registrar_jornada_negocio`. Os campos `negocios.*_situacao` passam a ser só projeção.
- `nivel_interesse` fica marcado como deprecado, sem ser apagado. O histórico de temperatura e de volta de etapa vai em `pipeline_historico`.
- No máximo 2 migrations, aplicadas fora do horário comercial.
