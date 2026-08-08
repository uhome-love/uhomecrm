# PDN: a verdade é o pipeline — reconciliação enxuta

## Regra
Só existe negócio se ele está no pipeline. O que não está no pipeline não existe no PDN. O bloco "Reconciliação — PDN x Negócios" para de tratar `negocios` como uma segunda verdade: ele passa a mostrar apenas o que impede o pipeline de aparecer corretamente no PDN, e a correção sempre puxa o dado para o lado do pipeline.

## O que sai do bloco
- **Negócio sem lead vinculado** — some. Se não tem lead, não é PDN. Deixa de ser listado (nem como aviso).
- **Fase do negócio ≠ etapa do lead** — deixa de ser "divergência para o gestor decidir". A etapa do lead manda: o alinhamento da fase passa a acontecer sozinho quando o PDN carrega, sem pedir clique.
- **Negócio ativo em lead arquivado** — o lead arquivado é a verdade: o negócio ativo dele não deve aparecer em lugar nenhum. Vira uma ação única "Encerrar negócio" (em vez de "Desarquivar lead"). Ganhos com lead arquivado continuam ignorados (fluxo normal).

## O que fica
- **Lead em etapa de negócio sem negócio criado** — este é o único caso que precisa de escrita para o PDN mostrar VGV. Continua listado com o botão "Criar negócio", já na fase da etapa do lead.

Resultado prático: em vez de ~22 itens misturados, o gestor vê só a lista curta de leads que precisam de negócio, mais eventuais negócios órfãos de lead arquivado. O restante se auto-corrige.

## Detalhes técnicos
- `src/hooks/pdn/usePdnDivergencias.ts`
  - remove o tipo `negocio_sem_lead` da coleta.
  - `fase_divergente`: em vez de virar linha na UI, entra numa lista interna aplicada em lote no fim do `load()` (`update negocios.fase = TIPO_TO_FASE[stage.tipo]`), com recarga silenciosa; nada é exibido.
  - `lead_arquivado`: `corrigir` passa a marcar o negócio como encerrado (`status='perdido'` + `updated_at`), não mais desarquivar o lead.
  - `lead_sem_negocio`: inalterado.
- `src/components/pdn/PdnDivergencias.tsx`: `GRUPOS` reduzido a `lead_arquivado` (ação "Encerrar negócio") e `lead_sem_negocio` (ação "Criar negócio"); remove o parágrafo de aviso de `negocio_sem_lead`.
- Nada muda em `v_pdn_linhas`, `usePdn.ts`, regras de VGV ou Vendas Realizadas. Sem migration.

## Validação
- Abrir `/pdn`: conferir que o contador da reconciliação cai para os casos reais e que nenhuma fase divergente permanece após o carregamento.
- Conferir que Ganho do mês e VGV do PDN continuam idênticos a Vendas Realizadas (agosto: 4 / R$ 1.315.000).
