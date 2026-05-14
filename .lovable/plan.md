## Contexto

Frente A (Cloudflare) será aplicada por você fora do código. Aqui implemento a Frente B no frontend para que, quando `api.uhomesales.com` falhar com `Failed to fetch`, o sistema:

- mostre estado claro de **indisponibilidade de conexão**
- **não rebaixe o cargo** para "corretor"
- **não exiba zeros falsos** como se fossem dados reais
- e, quando configurado, faça fallback **somente** para `api-backup.uhomesales.com` / `realtime-backup.uhomesales.com` — nunca para `*.supabase.co`

## Mudanças

### 1. Detector global de saúde da API
Novo `src/lib/apiHealth.ts`:
- escuta o `fetchCircuitBreaker` (já instalado em `main.tsx`)
- mantém estado `online | degraded | offline` baseado em janela curta de falhas vs sucessos para `api.uhomesales.com` e `realtime.uhomesales.com`
- expõe hook `useApiHealth()` e `subscribe()` para componentes
- emite evento `api-health:changed` para React Query reagir

### 2. Banner global de indisponibilidade
Novo `src/components/ApiOfflineBanner.tsx` montado no `AppLayout`:
- aparece quando `apiHealth = offline/degraded`
- texto: "Conexão com o servidor instável. Tentando reconectar..."
- botão "Tentar novamente" que invalida queries
- desaparece sozinho quando volta ao normal

### 3. `useUserRole` resiliente
- cachear o último array de roles válido em `sessionStorage` por user_id
- em erro de rede da query: **manter o último cargo válido** em vez de cair para `[]`
- expor `rolesStale: boolean` para a UI saber que está usando cache
- no `AppLayout`, enquanto `roles=[]` E há erro de rede, **não setar** `cargoLabel = "Corretor"`; mostrar "—" ou último cargo conhecido

### 4. Dashboards não mostram zero falso
Em `useCeoDashboard`, `useCeoData` e telas que hoje retornam `EMPTY_KPIS`/arrays vazios em erro:
- distinguir `error` (rede) de `data vazio real`
- quando `error` for rede, retornar `status: "unavailable"` em vez de zeros
- componentes mostram skeleton + mensagem "Indisponível — tentando reconectar" no lugar dos números

### 5. `useAuth` menos destrutivo em rede degradada
- `boot_ceiling` (8s): se a falha foi por rede (telemetria do circuit breaker), **não limpar storage**; apenas liberar UI mantendo sessão local válida e mostrar banner offline
- `visibilitychange`: não disparar refresh agressivo quando `apiHealth = offline`

### 6. Fallback de domínio (preparado, opcional)
Novo `src/lib/proxyEndpoints.ts`:
- `PRIMARY = { api: "https://api.uhomesales.com", realtime: "wss://realtime.uhomesales.com/realtime/v1" }`
- `BACKUP = { api: "https://api-backup.uhomesales.com", realtime: "wss://realtime-backup.uhomesales.com/realtime/v1" }`
- gate por flag em `sessionStorage` + variável de ambiente
- circuit breaker, ao detectar ≥5 `Failed to fetch` em 30s, marca `proxy:switched` e força recriação do client com BACKUP
- healthcheck a cada 5min volta para PRIMARY após 2 ciclos OK
- **regra dura**: lista de hosts permitidos só contém subdomínios `uhomesales.com`. Nada de `*.supabase.co` — assert em runtime que rejeita configuração inválida
- desligado por padrão até `api-backup.uhomesales.com` estar pronto no Cloudflare

### 7. Telemetria
- `log-auth-event` com novos `event_type`: `api_offline`, `api_recovered`, `proxy_switch`
- inclui contagem de falhas, host alvo, ASN aproximado (via `navigator.connection`)

## Arquivos

- novo: `src/lib/apiHealth.ts`
- novo: `src/lib/proxyEndpoints.ts`
- novo: `src/components/ApiOfflineBanner.tsx`
- editar: `src/lib/fetchCircuitBreaker.ts` (publicar eventos para o apiHealth)
- editar: `src/integrations/supabase/customClient.ts` (ler endpoint ativo, reagir a `proxy:switched`, asserção de host próprio)
- editar: `src/hooks/useUserRole.tsx` (cache + resiliência)
- editar: `src/hooks/useAuth.tsx` (boot_ceiling/visibility menos destrutivos em rede)
- editar: `src/components/AppLayout.tsx` (montar banner; cargoLabel não cai para "Corretor" em erro)
- editar: `src/hooks/useCeoDashboard.ts`, `src/hooks/useCeoData.ts` (status `unavailable` em erro de rede)
- editar: `src/lib/storageUrl.ts` (também respeitar endpoint ativo, sem `*.supabase.co`)

## Critério de aceite

- na Claro e no hotspot, com a Frente A aplicada: login/logout/carga de dados funcionam, sem `Failed to fetch` em DevTools
- todas as chamadas de Auth/REST/RPC/Functions/Storage vão para `*.uhomesales.com`
- em falha real de rede: banner de indisponibilidade visível, KPIs e listas mostram "Indisponível", **cargo não é rebaixado** para corretor
- nenhum request runtime para `*.supabase.co`, mesmo com circuit breaker ativo
- quando rede normaliza, banner some sozinho e dados voltam sem reload
