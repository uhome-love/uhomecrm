# Plano: Correção do fluxo de regredir negócio na PDN

## Contexto / Diagnóstico

O gestor Bruno tentou regredir um negócio na PDN (planilha de negócios do gestor) e recebeu o toast genérico: **"Você não tem permissão para alterar este lead"**. A investigação mostra que o erro é engolido pela mensagem fixa de `pdnSyncEngine.ts`; a causa real pode ser outra (trigger, RLS, payload inválido, etc.).

Situações identificadas no banco hoje:
1. **pdn_entry desatualizada**: Andressa Kieffer aparece na PDN como "Em Negociação" (pdn_entry `situacao = em_negociacao`), mas o lead real do pipeline está em **Visita**. A pdn_entry foi criada vinculada ao `negocio_id` e não ao `pipeline_lead_id`, então o botão de regredir não consegue mover o lead real.
2. **Regressão sem desbloquear lead**: se o lead estiver arquivado/descartado, o `syncPipelineStageFromPdn` apenas troca `stage_id`, mas mantém `arquivado = true` e `motivo_descarte`, deixando o lead invisível na operação.
3. **Logs insuficientes**: a mensagem de erro fixa impede saber se o problema é RLS, trigger, coluna obrigatória, etc.

## Escopo de mudanças

### 1. Logging real no `pdnSyncEngine.ts`
- Trocar o toast genérico por uma mensagem que mostre o **código + message** reais do Supabase no console e, em ambiente de debug, no toast.
- Logar payload enviado e IDs envolvidos para facilitar rastreamento.
- Garantir que falhas de `negocios` e `pipeline_leads` sejam reportadas separadamente.

### 2. Regressão robusta: desenvolver leads arquivados/descartados
- Em `syncPipelineStageFromPdn`, quando `oldStageId !== stageRow.id` e o lead estiver `arquivado = true`, incluir no `updatePayload`:
  - `arquivado: false`
  - `motivo_descarte: null`
  - `tipo_descarte: null`
- Isso permite que um lead descartado/inativado seja reativado ao regredir na PDN.

### 3. Resolver `pipeline_lead_id` a partir do `negocio_id` quando necessário
- Se a linha da PDN tem `negocio_id` mas `pipeline_lead_id` é null, buscar `negocios.pipeline_lead_id` e usar esse ID no `syncPipelineStageFromPdn`.
- Atualizar a pdn_entry para preencher o `pipeline_lead_id` vinculado após a operação.

### 4. Sincronizar `situacao` da pdn_entry com a nova etapa real
- Quando o gestor move o lead via PDN, após o `syncPipelineStageFromPdn`, atualizar a pdn_entries para:
  - `situacao = <novo_grupo>` (ex: `visita_realizada`)
  - `grupo_override = null`
  - `caiu = false`
- Isso evita que a PDN continue mostrando a etapa antiga depois do movimento.
- Ajustar `trg_pdn_mirror_pipeline_lead` para também atualizar `situacao` quando o lead é movido **fora** da PDN, mantendo o overlay alinhado.

### 5. Remover botão de regredir quando não há lead real vinculável
- Se `row.pipelineLeadId` é null e não conseguimos resolver via `negocio_id`, o botão de regredir não deve aparecer (apenas "Remover da planilha").
- Adicionar tooltip explicando que a linha não está vinculada a um lead real.

### 6. Validação no preview
- Reproduzir o fluxo com o usuário logado como gestor/admin.
- Confirmar que regredir de "Em Negociação" → "Visita Realizada" funciona sem toast de erro.
- Confirmar que a pdn_entry atualiza a etapa exibida.
- Confirmar que leads arquivados/descartados ressurgem na operação após regredir.

## Arquivos que serão alterados

- `src/lib/pdnSyncEngine.ts` — logs, desbloqueio de arquivado, resolução via negocio_id.
- `src/hooks/usePdn.ts` — atualização de `situacao` na pdn_entry após mudança de etapa.
- `src/pages/PdnGestor.tsx` — esconder botão de regredir quando não houver lead resolvido.
- Migration: `supabase/migrations/...` — extender `trg_pdn_mirror_pipeline_lead` para atualizar `situacao`.

## Riscos / Decisões

- **RLS**: A política de gestor já permite atualizar leads da equipe. Não será alterada; a correção foca em payload e referência correta.
- **Dados legados**: pdn_entries antigas vinculadas só a negocio_id serão corrigidas no primeiro uso (resolver pipeline_lead_id) e via trigger.
- **Sincronização automática**: o trigger atualizará pdn_entries de outros gestores quando o lead mudar fora da PDN; isso é desejado para manter a planilha fiel ao pipeline real.

## Validação esperada

- Toast de sucesso aparece ao regredir.
- Lead real muda de etapa no pipeline.
- pdn_entry reflete a nova etapa.
- Não há mais toast de "permissão" em cenários válidos.
- Se o erro real persistir, os logs mostrarão o código/message do Supabase para a próxima investigação.