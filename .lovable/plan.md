## Problema

A corretora Andressa Madril (e potencialmente outros usuários antigos) está com:

1. **PC — tela de login travada em "Entrando..."**: bundle/PWA antigo em cache + `signIn` pode levar ~15s sem feedback nem rota de escape.
2. **Mobile — clica "Criar Tarefa" no detalhe do lead e nada acontece**: combinação de chunk antigo em cache (runtime error silencioso) + bug de UX em `addTarefa` que retorna mudo quando `user` ainda não hidratou.

Confirmado no banco: login dela funciona no servidor (sign-in às 19:15 BRT hoje). Console mostra `Importing a module script failed` e `auth-boot ceiling reached (8s)` — assinatura clássica de cache poluído.

## Correções

### 1. Kill-switch agressivo no service worker (`public/sw.js`)
Reescrever para sempre que ativar:
- `caches.keys()` → deletar todos
- Forçar `client.navigate(url + ?_v=ts)` em todas as abas abertas
- `unregister()` ao final

Isso garante que mesmo dispositivos com SW antigo, na próxima abertura, sejam reciclados de uma vez — sem depender do `main.tsx` carregar primeiro.

### 2. UX resiliente em `LeadTarefasTab.handleCreate`
- Adicionar estado `creating` no botão (spinner + disabled)
- `try/catch` em volta de `onAddTarefa` com `toast.error`
- Validar `tipo` e `vence_em` antes de chamar (toast claro se faltar data)

### 3. `addTarefa` em `usePipelineLeadData.ts` deixar de falhar mudo
- Se `!user`, mostrar `toast.error("Sessão expirou — recarregue a página")` em vez de `return` silencioso
- Logar `console.error` com o motivo
- Retornar `boolean` para o caller saber o resultado

### 4. Auth — desbloqueio durante "Entrando..."
- Reduzir `MAX_ATTEMPTS` de signIn de 3 para 2 (mais responsivo) e `waitForFreshSession` de 5s para 3s
- Mostrar o botão "Corrigir acesso neste dispositivo" também enquanto `submitting=true` (hoje só aparece quando idle)
- Após 8s travado em "Entrando...", auto-mostrar um aviso "Demorando demais? Toque em corrigir acesso"

### 5. Telemetria
Adicionar `sendAuthTelemetry({event_type: "task_create_blocked"})` quando `addTarefa` cair no caminho `!user`, para detectarmos esse cenário em outros usuários.

## Arquivos afetados

- `public/sw.js` — kill-switch reforçado
- `src/components/pipeline/LeadTarefasTab.tsx` — handleCreate com estado loading + try/catch + validação
- `src/hooks/usePipelineLeadData.ts` — addTarefa com toast/log e retorno boolean
- `src/hooks/useAuth.tsx` — reduzir timeouts do signIn
- `src/pages/Auth.tsx` — botão "Corrigir acesso" sempre visível + aviso após 8s

## O que NÃO vai mudar

- RLS, schema de `pipeline_tarefas`, lógica de roleta, fluxo de aceite — nada disso é o problema.
- Cargo/role da Andressa (já está corretor com profile válido).

## Para a Andressa, no momento do deploy

Como o cache antigo dela ainda vai precisar de UM ciclo para pegar o novo SW, ela vai precisar **uma única vez**:
- No PC: clicar no link "Está preso na tela de login? Corrigir acesso neste dispositivo" (já existe).
- No celular: forçar fechar o app PWA e abrir de novo (o novo SW já vai limpar tudo).

Depois disso, todos os deploys futuros são automáticos.
