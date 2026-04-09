

# Plano: Corrigir Criação Automática de Negócio no Pipeline

## Diagnóstico

O fluxo principal em `usePipeline.ts` (linha 435) já está correto — só cria negócio quando o lead vai para `convertido` (Negócio Criado). O trigger de banco `lead_to_negocio_on_visita_realizada` já foi removido.

Porém encontrei **dois problemas residuais**:

### 1. `useLeadProgression.ts` — função `onVisitaRealizada` (linha 48-81)
Cria negócio automaticamente ao marcar visita como realizada. Embora não esteja sendo chamada atualmente, é código ativo exportado que pode ser invocado no futuro. O comentário diz "GATILHO 2: Visita realizada → create negócio" — contradiz a regra atual.

### 2. `PipelineBoard.tsx` — Auto-fix (linhas 285-306)
Move automaticamente qualquer lead que tenha `negocio_id` para a coluna "Negócio Criado". Isso é problemático porque se por qualquer razão um lead tiver `negocio_id` vinculado (regressão, bug anterior), ele será forçado para a etapa convertido sem intervenção do corretor.

### 3. `usePipeline.ts` — label `origem: "visita_realizada"` (linha 474)
O insert do negócio na etapa convertido usa `origem: "visita_realizada"` como texto fixo. Deveria ser `"pipeline_convertido"` ou similar.

## Correções

| Arquivo | Ação |
|---------|------|
| `src/hooks/useLeadProgression.ts` | Remover a criação de negócio da função `onVisitaRealizada`. Manter apenas registro de atividade/toast, sem insert em `negocios`. |
| `src/components/pipeline/PipelineBoard.tsx` | Remover o bloco auto-fix (linhas 285-307). Leads não devem ser movidos automaticamente. |
| `src/hooks/usePipeline.ts` | Trocar `origem: "visita_realizada"` por `origem: "pipeline_convertido"` na linha 474. |

## Risco
Baixo. Remove comportamentos automáticos indesejados. A criação de negócio fica exclusivamente no `moveLead` ao entrar em `convertido`.

