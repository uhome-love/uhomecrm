

# Correção da Roleta: Fase 1 — Plano Final (com guarda no RPC)

## 3 mudanças cirúrgicas

### 1. Edge Function `distribute-lead/index.ts`
Linha ~109: trocar `const forceDispatch = true` por `const forceDispatch = (action === "dispatch_fila_ceo")`

### 2. UI `src/hooks/useRoleta.ts`
Ordenar fila por `ultima_distribuicao_at ASC NULLS FIRST` em vez de contagem agregada do dia. Indicador "Próximo" passa a refletir a ordem real do motor.

### 3. Migração SQL — Diagnóstico no RPC `distribuir_lead_atomico`

**INSTRUÇÃO CRÍTICA**: Na migração SQL do `distribuir_lead_atomico`, **não alterar nenhuma lógica de seleção de corretor, filtros de elegibilidade ou fluxo de attempt 1/attempt 2**. Apenas adicionar contadores de diagnóstico (`total_fila`, `total_eligible`, `total_blocked_na_roleta`, `failure_reason`) ao objeto de retorno quando `v_chosen_auth_id IS NULL` no attempt 1. O resto da função fica idêntico.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `supabase/functions/distribute-lead/index.ts` |
| Modificar | `src/hooks/useRoleta.ts` |
| Migração SQL | `distribuir_lead_atomico` (só diagnóstico, zero alteração de lógica) |

## O que NÃO muda
- Nenhuma lógica de seleção/filtro/attempt no RPC
- Nenhuma alteração em aceite/rejeição
- Nenhuma aba existente da Roleta
- Centralização da fila fica para Fase 2

