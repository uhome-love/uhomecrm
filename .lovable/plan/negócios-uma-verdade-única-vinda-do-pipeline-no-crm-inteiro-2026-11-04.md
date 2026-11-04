# Negócios: uma verdade única, vinda do Pipeline, no CRM inteiro

## Regra principal (decisão do Lucas)
- **O Pipeline é a única verdade.** A etapa do cliente define se ele é negócio, e em qual fase. Todos os relatórios, painéis (CEO, diretora, gerente, corretor), PDN, Performance e o quadro de Negócios leem a mesma régua.
- **Pós-visita ainda não é negócio.** Vira negócio quando entra em Documentação, Proposta, Contrato ou Ganho.
- **Temperatura tem três níveis:** Frio, Morno e Quente.

## O que encontrei (conferido no sistema)
- A ficha do negócio só conhece 3 fases, com estes números hoje: em negociação 274, contrato 7, ganho 128. O Pipeline tem etapas próprias, então são duas réguas. Cerca de 45 telas leem a ficha do negócio diretamente.
- O feedback da visita grava "Muito quente", mas o botão do Resumo não consegue trocar isso por Quente. É o problema da foto. O topo do Resumo ainda usa outra escala, com Urgente e Gelado.
- O Resumo pede Interesse (Alto, Médio ou Baixo) e Temperatura, que repetem a mesma ideia.
- A situação do negócio aparece em três lugares diferentes. No caso do Vitor, a nota diz "aprovado, vai gerar contrato", mas a situação continua "Proposta enviada".
- O feedback da visita só aparece no histórico.
- Entre os clientes de Visita até Contrato: 37 sem temperatura, 3 frios, 9 mornos, 4 quentes e 1 muito quente.

## 1. Fluxo etapa por etapa

```text
Visita -> Pós-visita -> [ NEGÓCIO: Documentação -> Proposta -> Contrato -> Ganho ]
```

| Etapa | Para entrar | Situação (escolher 1) | Para avançar |
|---|---|---|---|
| Pós-visita | Visita realizada + feedback | Pensando, Quer proposta, Aguardando família, Comparando | Temperatura + próximo passo |
| Documentação | Cliente quer seguir | Pendente, Enviada, Em análise, Aprovada, Reprovada | RG/CPF, renda, residência |
| Proposta | Imóvel + unidade | Enviada, Contraproposta, Aprovada, Recusada | Valor + aprovada |
| Contrato | Proposta aprovada | Em confecção, Gerado, Em leitura, Assinatura marcada | Data prevista de assinatura |
| Ganho | Confirmação de venda atual (sem mudança) | — | Comprovante + intermediação |

- Pode voltar uma etapa, com motivo registrado no histórico.

## 2. Pós-visita com feedback correto
Ao registrar a visita, o corretor preenche um formulário único:
- Resultado (como hoje)
- Temperatura: Frio, Morno ou Quente
- Objeção: Preço, Localização, Crédito, Planta, Família ou Nenhuma
- Situação do pós-visita
- Próximo passo com data, que vira tarefa
- Observação de pelo menos 10 letras

Tudo isso aparece na aba Negócio como "Última visita", e não só no histórico. Se a temperatura ficar em branco, a anterior é mantida.

## 3. Modal do lead na fase negócio
- **Resumo (topo):** mostra temperatura, situação e próximo passo, todos editáveis. O "Interesse" sai.
- **Aba Negócio, sempre na mesma ordem:**
  1. Termômetro: temperatura, situação, próximo passo e quando foi atualizado
  2. Imóvel, unidade e valor
  3. Última visita e objeção
  4. Parte da etapa atual: documentos, proposta ou contrato
  5. Notas do negócio, com data e autor
- **Info:** o botão principal muda conforme a etapa (Atualizar documentos, Atualizar proposta, Atualizar contrato ou Confirmar venda).
- A temperatura pode subir ou descer em qualquer lugar, e cada troca fica no histórico.

## 4. Relatórios e painéis
- Todos os números de negócio passam a vir de uma única fonte que lê o Pipeline: negócios em documentação, em proposta, em contrato e ganhos.
- A lista de telas que mudam, com os números de antes e depois, será mostrada antes da troca. VGV e vendas ganhas não mudam.

## 5. Validação e teste ponta a ponta
- Antes de qualquer mudança, guardo os números atuais de CEO, gerente, Performance, PDN e Negócios.
- O cliente de teste "TESTE Negócio Ponta a Ponta" passa por todo o fluxo: Visita, feedback, Pós-visita, Documentação, Proposta, Contrato e a tela de Ganho, que será cancelada no final. No caminho, a temperatura sobe e desce, e uma etapa é desfeita.
- A conferência é ao vivo no computador e no celular, em cinco lugares: Resumo, aba Negócio, card, quadro de Negócios e painéis.
- Testes automáticos cobrem as regras de entrada e de avanço de cada etapa, as três temperaturas e a volta com motivo.
- No fim, o cliente de teste é arquivado, sem afetar números, Roleta ou VGV.

## Ordem de trabalho (padrão obrigatório)
1. Desenho do fluxo, do Pós-visita e do modal na fase negócio, no computador e no celular, para sua aprovação.
2. Fase 0: régua única Pipeline → negócio, mais a fonte única para relatórios.
3. Fase 1: três temperaturas e conversão dos valores antigos. Corrige o caso do Vitor.
4. Fase 2: formulário do Pós-visita.
5. Fase 3: modal do lead na fase negócio.
6. Fase 4: troca dos relatórios para a fonte única e teste ponta a ponta.

## Fora deste plano
Roleta, distribuição, contagem de visitas, regra do VGV, confirmação de venda, Financeiro e intermediação.

## Detalhes técnicos
- `negocios.fase` passa a ser projeção de `pipeline_stages.tipo` (documentacao, proposta, contrato_gerado, venda) via trigger. Registros `ganho` ficam intactos; o backfill afeta só os ativos.
- Nova view/RPC única, `v_negocios_pipeline`, consumida pelas cerca de 45 leituras de `negocios`, migradas uma por vez com comparação antes e depois.
- `pipeline_leads.temperatura` passa a aceitar só `frio|morno|quente|null`. Backfill: `muito_quente/urgente→quente`, `gelado→frio`, `nao_definida→null`, mais um trigger de validação.
- O helper `src/lib/temperatura.ts` atende TemperaturaChip, ResumoLead, VisitaResultadoDialog, CardMinimal, filtros e ordenação.
- A situação usa `flag_status` via `registrar_jornada_negocio`. `nivel_interesse` fica deprecado, com comentário e sem drop. O histórico vai para `pipeline_historico`.
- No máximo 2 migrations, aplicadas fora do horário comercial.
