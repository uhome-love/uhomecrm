
# Plano: Corrigir Leads Invisíveis no Pipeline (aceite_status stuck)

## Diagnóstico

Leads como "Naira" (Adriana), "Elaine", "Nádia" têm `corretor_id` atribuído mas `aceite_status = 'pendente_distribuicao'`. Isso cria um estado impossível:
- Pipeline do corretor filtra `aceite_status = 'aceito'` (linha 193 de `usePipeline.ts`) → lead invisível
- Página de Aceite filtra `aceite_status IN ('pendente', 'aguardando_aceite')` → lead também invisível
- Resultado: lead fantasma — existe no banco mas ninguém vê

**Causa raiz:** O webhook CRM (dedup path, linha 232-246 de `crm-webhook/index.ts`) reativa um lead existente (`arquivado: false`, move para Novo Lead) mas **não atualiza o `aceite_status`**. Se o lead estava com `pendente_distribuicao`, fica preso nesse estado mesmo com corretor atribuído.

## Correções

### 1. Webhook CRM — dedup path
**Arquivo:** `supabase/functions/crm-webhook/index.ts` (linha ~234)

Quando reativando lead existente que já tem corretor, setar `aceite_status: 'aceito'`. Se não tem corretor, setar `aceite_status: 'pendente_distribuicao'` para entrar na roleta.

### 2. Proteção no pipeline query
**Arquivo:** `src/hooks/usePipeline.ts` (linha 193)

Trocar `.eq("aceite_status", "aceito")` por `.in("aceite_status", ["aceito", "pendente"])` para corretores. Assim leads aguardando aceite também aparecem no pipeline (com badge visual, se necessário), evitando que fiquem invisíveis se o aceite_status ficar preso.

### 3. Corrigir leads stuck no banco
**Migração de dados:** UPDATE nos 4 leads que têm `corretor_id IS NOT NULL` e `aceite_status = 'pendente_distribuicao'` para `aceite_status = 'aceito'`.

### 4. Segurança futura — trigger de proteção
Adicionar validação: se `corretor_id` é atribuído e `aceite_status` é `pendente_distribuicao`, automaticamente mudar para `pendente` (via trigger ou na lógica da RPC).

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/crm-webhook/index.ts` | Adicionar `aceite_status` no update de dedup |
| `src/hooks/usePipeline.ts` | Expandir filtro do corretor para incluir `pendente` |
| Migração SQL | Corrigir 4 leads stuck |

## Risco
Baixo. A mudança no filtro do pipeline pode mostrar leads que antes ficavam na página de aceite, mas isso é desejável — melhor visível do que invisível.
