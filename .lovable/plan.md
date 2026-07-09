## Auditoria — por que Victor e Denis apareceram em "Ganho" de Julho

Ambos são negócios **antigos** que "reapareceram" em Julho por causa de uma falha na regra de recorte mensal do PDN.

- **Victor Ouriques** (`d991…`): assinado em fevereiro, mas **não tem registro de negócio** (sem `data_assinatura`, sem VGV). Hoje (09/07) o card foi movido para a etapa "Ganho/venda". Sem `data_assinatura`, o PDN usou a data da última mudança de etapa (09/07) → caiu em Julho.
- **Denis** (`5c55…`): negócio Open Bosque, R$ 361.000, fase "vendido" criado em 25/03, mas com **`data_assinatura` em branco**. A etapa foi tocada em 08/07 → sem `data_assinatura`, usou 08/07 → Julho.

**Causa raiz (código):** em `usePdn.ts`, o mês do Ganho é `mesOf(data_assinatura || stage_changed_at)`. O `stage_changed_at` é volátil (muda quando alguém mexe no card hoje), então negócios sem data de assinatura sempre "pulam" para o mês atual.

## Correções

### 1. Corrigir os dados dos dois negócios
- **Denis**: preencher `data_assinatura = 29/01/2026` no negócio existente (Open Bosque). Ele passa a contar em Janeiro e sai de Julho.
- **Victor**: criar o registro de negócio que faltava, vinculado ao lead, com `data_assinatura = 10/02/2026`, empreendimento "Alto Lindóia", corretor atual do lead, fase "vendido", status "ativo", VGV 0 (o gestor ajusta depois pelo PDN). Ele passa a contar em Fevereiro e sai de Julho.

### 2. Corrigir a regra de recorte mensal do Ganho (estrutural)
Em `usePdn.ts`, mudar o mês do Ganho para **nunca** usar `stage_changed_at`:
- Prioridade 1: `data_assinatura`.
- Prioridade 2 (quando faltar `data_assinatura`): **a primeira data em que o negócio entrou na etapa de venda**, lida do histórico (`pipeline_historico`), que é estável.
- Se não houver nenhuma das duas, o negócio **não é atribuído a nenhum mês** (fica de fora do recorte até o gestor preencher a data), em vez de cair no mês atual.

A coluna "Data" exibida no Ganho passa a seguir a mesma prioridade (`data_assinatura` → primeira data de venda), para bater com o mês do recorte.

## Detalhes técnicos
- Dados: um `UPDATE` em `negocios` (Denis) e um `INSERT` em `negocios` (Victor) via ferramenta de dados.
- Código: adicionar no `loadDeals` uma busca em `pipeline_historico` (apenas para os leads em etapa de venda) para obter a menor data de entrada na etapa "venda" por lead; usar essa data como fallback no cálculo de `refMes` e no campo `data` do Ganho. Sem alteração de schema.
- Nada disso altera o trabalho do corretor no pipeline; só corrige atribuição de mês e completa dados de negócio.

## Verificação após aplicar
- Confirmar que Victor sai de Julho e aparece em Fevereiro; Denis sai de Julho e aparece em Janeiro.
- Reconfirmar as contagens de anomalia (negócios "vendido" sem `data_assinatura` e leads em "venda" sem negócio) — devem zerar para esses casos.