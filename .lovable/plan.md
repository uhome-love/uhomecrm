
# Plano: Excluir leads em Descarte dos status "Atrasado" e "Desatualizado"

## Problema
Leads na etapa "Descarte" estão sendo classificados como "atrasados" ou "desatualizados" nos indicadores do pipeline e na inteligência. Leads descartados não são mais ativos e devem ser sempre considerados neutros.

## Mudanças

### 1. `src/components/pipeline/CardStatusLine.tsx`
- Adicionar parâmetro opcional `stageTipo` nas funções `getLeadStatusFilter` e `getCardStatus`
- Se `stageTipo === "descarte"`, retornar imediatamente `"em_dia"` (sem indicador de atraso/desatualizado)
- Na função `getCardStatus`, quando descarte, exibir texto neutro como "Descartado" com indicador cinza

### 2. `src/pages/PipelineKanban.tsx`
- Passar o `stageTipo` ao chamar `getLeadStatusFilter` nos filtros e contadores, usando o mapa de stages já disponível

### 3. `src/components/pipeline/PipelineCard.tsx`
- Passar `stage?.tipo` ao chamar `getCardStatus` para que o card reflita o status correto

### 4. `src/hooks/useLeadsParados.ts`
- Adicionar campo opcional `stage_tipo` na interface `LeadWithDate`
- Pular leads com `stage_tipo === "descarte"` (similar ao skip de `pos_vendas`)

### 5. `src/hooks/useLeadIntelligence.ts`
- Na contagem de KPIs e métricas, filtrar leads em stages do tipo "descarte" para não inflarem contadores de "desatualizados" ou "atrasados"

## Arquivos afetados
- `src/components/pipeline/CardStatusLine.tsx`
- `src/pages/PipelineKanban.tsx`
- `src/components/pipeline/PipelineCard.tsx`
- `src/hooks/useLeadsParados.ts`
- `src/hooks/useLeadIntelligence.ts`
