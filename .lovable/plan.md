# Correção: pipeline infinito, credenciamento da roleta e cache do corretor

## Diagnóstico (causa raiz)

Investiguei `usePipeline.ts`, `useUserRole.tsx`, `useRoleta.ts`, `useElegibilidadeRoleta.ts` e `AppLayout.tsx`. As três queixas têm causas independentes e identificadas:

### 1. Pipeline "Carregando pipeline…" infinito
- Em `usePipeline.ts` (linhas 357-415) o efeito principal faz `if (roleLoading) return;` **antes** de armar o timeout de 30s.
- `useUserRole` usa React Query com `retry` em `Failed to fetch`. Se o corretor está em Wi-Fi instável (caso típico do Acer da foto) e a chamada a `user_roles` flapa, `isLoading` fica `true` enquanto a query retry’a — sem timeout — e o pipeline nunca arma seu próprio timeout. Resultado: spinner eterno, sem error state.
- O cache em `sessionStorage` existe mas só é usado **depois** da query terminar, não para destravar o `loading` inicial.

### 2. Corretor não consegue se credenciar na roleta
- Em `useRoleta.ts` linha 270 a busca do `profileId` usa `.single()`. Se a primeira tentativa falhar (rede) ou retornar 0/2 linhas (perfil ainda não migrado), a promise rejeita silenciosamente, `profileId` permanece `null`, e a função `credenciar()` cai no `if (!user || !profileId) return;` (linha 453) — **sem toast, sem retry, sem log para o usuário**. O corretor clica e nada acontece.

### 3. Falta botão "Limpar cache" no menu do avatar
- `AppLayout.tsx` (linhas 224-243) tem o `DropdownMenuContent` com "Configurações" e "Sair" só. Sem opção para o corretor desempacar SW/cache quando algo trava.

---

## Plano de correção

### A. `src/hooks/usePipeline.ts` — destravar o loading
1. Remover o early-return em `if (roleLoading) return;`. Em vez disso, **disparar `loadStages` e `loadSegmentos` imediatamente** (não dependem de role) e só atrasar `loadLeads` enquanto role não resolveu.
2. Adicionar timeout de **8 segundos** específico para `roleLoading`: se passar, prosseguir assumindo `isGestor=false, isAdmin=false` (corretor é o caso mais comum e seguro — vê só os próprios leads).
3. Garantir que o `setLoading(false)` no `.finally()` rode **mesmo quando o efeito retorna cedo** — mover o timeout de 30s para fora do `if (roleLoading)`.

### B. `src/hooks/useUserRole.tsx` — não segurar a UI
1. Trocar `retry: count < 3` por `retry: 1` com `retryDelay: 500ms`.
2. Adicionar `placeholderData` lendo o cache de `sessionStorage` no primeiro render, para `isLoading` virar `false` imediatamente quando há cache.
3. Manter o refetch em background, mas a UI não fica mais bloqueada esperando.

### C. `src/hooks/useRoleta.ts` — credenciamento confiável
1. Trocar `.single()` por `.maybeSingle()` na busca do `profileId` (linha 270).
2. Se não retornar perfil em até 2 tentativas, mostrar `toast.error("Não foi possível carregar seu perfil. Recarregue a página.")` e logar `[useRoleta] profileId missing`.
3. Em `credenciar()`: se `!profileId`, mostrar toast explicando ao invés de `return` silencioso, e tentar resolver o profileId on-demand antes de desistir.

### D. `src/hooks/useElegibilidadeRoleta.ts` — robustez
1. Adicionar retry simples (2 tentativas com 800ms de delay) na RPC `get_elegibilidade_roleta`.
2. Em caso de falha, exibir card com mensagem "Não foi possível verificar elegibilidade — toque para tentar novamente" em vez de retornar `null` e o componente sumir.

### E. `src/components/AppLayout.tsx` — botão "Limpar cache"
Adicionar novo `DropdownMenuItem` acima de "Sair" com ícone `RefreshCw`:

```
Limpar cache e recarregar
```

Ação:
1. Limpar `sessionStorage` inteiro.
2. Limpar do `localStorage` apenas as chaves não-críticas (`uhome:*` exceto `uhome:auth:*` para não deslogar). Remover `react-query` cache se houver.
3. Limpar caches do Service Worker via `caches.keys() → caches.delete()`.
4. Mandar mensagem `{type: 'SKIP_WAITING'}` para o SW ativo.
5. `window.location.reload()` (hard reload via `?_recover=cache&t=Date.now()` para furar SW residual — padrão já existente no projeto, conforme `swKillSwitch.ts`).
6. Mostrar `toast.success("Cache limpo. Recarregando…")` antes do reload.

---

## Detalhes técnicos

- Nenhuma mudança de schema; apenas frontend.
- Nenhum edge function tocado.
- `runQueryWithRetry` e `taskQueryUtils` permanecem como estão (já fazem o trabalho dentro do escopo onde são usados).
- O kill switch existente (`src/lib/swKillSwitch.ts`) será reutilizado pelo botão de limpar cache — não criamos nova lógica de SW.
- Sem mudança em `src/integrations/supabase/client.ts` (memória reforça: nunca editar).

## Arquivos a tocar

1. `src/hooks/usePipeline.ts` — destravar loading + role timeout
2. `src/hooks/useUserRole.tsx` — placeholderData + retry mais curto
3. `src/hooks/useRoleta.ts` — `.maybeSingle()` + toast no credenciar
4. `src/hooks/useElegibilidadeRoleta.ts` — retry + estado de erro visível
5. `src/components/AppLayout.tsx` — item "Limpar cache" no DropdownMenu

## Como validar

1. Abrir `/pipeline-leads` como corretor → deve sair do "Carregando pipeline…" em <10s mesmo com rede ruim, ou mostrar mensagem de erro acionável.
2. `/roleta-leads` → clicar em "Credenciar" e ver toast claro (sucesso ou erro).
3. Avatar → "Limpar cache e recarregar" → toast + reload duro; após reload, sessão preservada, pipeline carrega normal.
