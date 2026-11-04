# Negócios organizados — uma fonte única para classificar o cliente

## O que encontrei (conferido no sistema)
- **Temperatura com 4 escalas diferentes.** O feedback da visita grava "Muito quente". O botão do Resumo só conhece Frio / Morno / Quente e trata "Muito quente" como se já fosse "Quente". Por isso, ao clicar em "Quente", nada acontece, e o topo continua mostrando "Muito quente". É esse o problema da sua foto. O Resumo ainda mostra outra escala no topo (Urgente, Gelado...).
- **Temperatura e Interesse repetem a mesma ideia.** O Resumo tem "Interesse Alto/Médio/Baixo" e também "Temperatura". O corretor preenche os dois sem saber qual vale.
- **A situação do negócio fica em três lugares:** na etapa do cliente (ex.: "Proposta enviada"), na aba Negócio e no texto da proposta. No caso do Vitor, a observação diz "Cliente aprovado, vai gerar contrato", mas a situação continua "Proposta enviada".
- **Feedback da visita fica perdido no histórico.** O resultado, a objeção e a observação aparecem só como texto na linha do tempo. A aba Negócio não mostra nada disso.
- Hoje, entre os clientes de Visita até Contrato: 37 sem temperatura, 3 frios, 9 mornos, 4 quentes e 1 muito quente.

## A proposta: um único "Termômetro do negócio"
Cada cliente em negócio passa a ter **um único quadro de classificação**, igual em todos os lugares: Resumo, aba Negócio, feedback da visita e card do Pipeline.

```text
+-------------------------------------------------+
| TERMÔMETRO DO NEGÓCIO          atualizado ontem |
| Temperatura:  Frio | Morno | Quente | Muito quente |
| Situação:     Proposta aprovada  (por etapa)     |
| Próximo passo: Gerar contrato até 06/11          |
| Última visita: 01/11 · Quer proposta · Thalia    |
|   "Gerar contrato unidade 512 torre 2"           |
| Objeção:      — (ou Preço / Localização / ...)   |
| [Reclassificar]                                  |
+-------------------------------------------------+
```

### 1. Temperatura em uma escala só (corrige o bug)
- Quatro níveis para todos: Frio, Morno, Quente e Muito quente. Também é possível deixar sem classificação.
- O mesmo botão no Resumo, no feedback da visita, na aba Negócio e no card permite **subir ou descer a qualquer momento**.
- Valores antigos são convertidos: Urgente vira Muito quente, e Gelado vira Frio.
- Cada mudança fica no histórico ("Temperatura: Muito quente → Morno · Gabriel"), assim o gestor vê quem desclassificou e quando.

### 2. Interesse deixa de existir separado
- "Interesse Alto/Médio/Baixo" sai do Resumo e a temperatura passa a ser a única régua.
- O valor antigo continua guardado e é usado só para sugerir uma temperatura a quem ainda não tem.

### 3. Situação do negócio em um só lugar
- A situação de cada etapa usa as opções que já existem, como Proposta enviada, Aprovada, Aprovação bancária, Documentação e Contrato em confecção.
- É editada no Termômetro e vale igual para o card, a etapa e a aba Negócio, sem um texto livre contradizendo outro.
- A observação continua existindo, mas como **nota do negócio**, com data e autor.

### 4. Feedback pós-visita alimenta o Termômetro
- Ao registrar a visita, o resultado, a temperatura, a objeção e a observação preenchem o Termômetro.
- Esses dados ficam visíveis como "Última visita" na aba Negócio, e não só no histórico.
- Se a temperatura não for escolhida, a anterior é mantida. Hoje ela pode ser sobrescrita.

### 5. Aba Negócio reorganizada (mesma ordem em todas as etapas)
1. Termômetro (temperatura, situação e próximo passo)
2. Imóvel, unidade e valor
3. Última visita e objeção
4. Proposta, documentos e contrato, mostrando só a parte da etapa atual
5. Notas do negócio

## Ideias extras (opcionais, você escolhe)
- **A. Alerta de classificação velha:** se a temperatura passar 7 dias sem atualização em Negociação ou Contrato, ela aparece em cinza com o aviso "reclassificar".
- **B. Próximo passo obrigatório:** em Em Negociação e Contrato, salvar exige um próximo passo com data, que vira tarefa automaticamente.
- **C. Filtro "Negócios quentes"** no Pipeline e no painel do gerente, para o gestor cobrar os Quentes e Muito quentes.
- **D. Motivo ao esfriar:** ao descer de Quente para Frio, pedir um motivo rápido (Preço, Crédito, Desistiu, Concorrente).

## Ordem de trabalho (padrão obrigatório)
1. **Desenho** do Termômetro e da nova aba Negócio, no computador e no celular, para sua aprovação.
2. Fase 1: escala única de temperatura e conversão dos valores antigos. Corrige o caso do Vitor.
3. Fase 2: Termômetro no Resumo e na aba Negócio, com a situação unificada.
4. Fase 3: feedback pós-visita alimentando o Termômetro.
5. Fase 4: ideias extras que você aprovar.
- Cada fase é conferida ao vivo com um cliente de teste, sempre cancelando, sem mexer em leads reais.

## Fora deste plano
Regras da Roleta, distribuição, contagem de visitas, VGV, confirmação de venda, Financeiro e intermediação continuam iguais.

## Detalhes técnicos
- `pipeline_leads.temperatura` passa a usar um domínio único: `frio|morno|quente|muito_quente|null`. Fazer backfill de `urgente→muito_quente`, `gelado→frio` e `nao_definida→null` pela ferramenta de dados. Uma validação por trigger impede novos valores fora do domínio.
- O helper compartilhado `src/lib/temperatura.ts` concentra rótulos, cores e ordem. É usado por TemperaturaChip, ResumoLead, VisitaResultadoDialog, CardMinimal, filtros e ordenação. Cobrir com testes: Muito quente → Quente precisa salvar, e Urgente precisa ler como Muito quente.
- TemperaturaChip: remover a comparação por "tier" que bloqueia a troca e comparar o valor real.
- A situação usa a fonte já existente, `flag_status` por etapa, via `registrar_jornada_negocio`. Os campos `negocios.*_situacao` passam a ser só projeção.
- `nivel_interesse` fica deprecado, apenas com comentário e sem drop.
- O histórico de temperatura vai para `pipeline_historico` ou atividade, sem nova tabela.
- No máximo 1 migration, aplicada fora do horário comercial.
