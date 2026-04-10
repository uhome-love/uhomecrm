

## Plano: Corrigir filtros do + Filtros para funcionar com dados reais

### Problemas identificados

1. **"Dias sem ação"** usa `stage_changed_at` em vez de `ultima_acao_at`. O campo `ultima_acao_at` já existe na tabela `pipeline_leads` e já é carregado pelo `usePipeline`. Deve ser a referência primária (com fallback para `stage_changed_at`).

2. **"Visita marcada"** filtra apenas por leads que estão em etapas do tipo "visita" no funil — não verifica se o lead tem visita real agendada na tabela `visitas`. Deve consultar visitas reais vinculadas ao `pipeline_lead_id`.

### Alterações

**Arquivo: `src/components/pipeline/PipelineAdvancedFilters.tsx`**

**1. Corrigir filtro "Dias sem ação" (linhas 159-165)**
- Trocar `l.stage_changed_at` por `l.ultima_acao_at || l.stage_changed_at` na função `applyFilters`, alinhando com a mesma lógica já usada em `useLeadsParados` e `useFocusLeads`.
- Adicionar opções `> 15 dias` e `> 30 dias` na UI (linhas 525-528) para identificar leads de longo prazo parados.

**2. Corrigir filtro "Visita marcada" (linhas 187-194)**
- Adicionar prop `visitaLeadIds: Set<string>` ao componente (um Set de `pipeline_lead_id` com visitas agendadas/confirmadas).
- No `applyFilters`, ao invés de filtrar por tipo de etapa, verificar se o lead.id está no Set de visitas reais.
- Na UI, manter as opções "Sim" / "Não" como estão.

**Arquivo: `src/pages/PipelineKanban.tsx`**
- Fazer uma query à tabela `visitas` filtrando `status != 'cancelada'` e `data_visita >= hoje`, coletando os `pipeline_lead_id`.
- Passar o Set resultante como prop `visitaLeadIds` para o `PipelineAdvancedFilters`.

### Detalhes técnicos

- `ultima_acao_at` já está no `PipelineLead` type e é carregado no select do `usePipeline`.
- A tabela `visitas` tem campos `pipeline_lead_id`, `status` e `data_visita` que permitem a consulta.
- Nenhuma migração de banco necessária — todos os campos já existem.

