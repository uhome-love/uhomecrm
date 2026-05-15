## Diagnóstico de raiz

Comparei o estado atual com o **commit `ef30ac4e` (13/05 18:55 BRT — último estável)**, antes da cascata começar. O resultado é categórico:

### O que existia no estado estável (3 meses funcionando em qualquer rede)
- `src/integrations/supabase/client.ts` — **único** cliente Supabase, plain, sem wrapper
- `src/main.tsx` — **54 linhas** (apenas createRoot)
- `src/hooks/useAuth.tsx` — **150 linhas** (auth simples)
- `public/sw.js` — **172 linhas**, Stale-While-Revalidate real (PWA abria instantâneo até offline)
- **NENHUM** arquivo de "resiliência" de rede

### O que existe HOJE (mesmo após o revert de ontem à noite)
- `src/main.tsx` — **171 linhas** (+217%): kill switch one-shot + version polling 60s + recovery flags + cleanup localStorage
- `src/hooks/useAuth.tsx` — **501 linhas** (+234%): retry, refresh, telemetria, health monitor
- `public/sw.js` — **103 linhas**: virou kill switch que **purga cache em toda activate** e força reload com cache-bust
- **11 arquivos novos** de interceptação de rede:
  - `customClient.ts` — segundo cliente Supabase com **wrapper de fetch** que loga toda falha em `network_telemetry`
  - `fetchCircuitBreaker.ts` — patcheia `window.fetch` GLOBAL com **timeout 15s via AbortController** + retries
  - `apiHealth.ts` — flipa para "offline" após **5 falhas em 30s**
  - `ApiOfflineBanner.tsx` — banner vermelho "Conexão indisponível" que apareceu no print do corretor
  - `originalFetch.ts`, `networkTelemetry.ts`, `edgeBaseUrl.ts`, `storageUrl.ts`, `swKillSwitch.ts`, `authHealthMonitor.ts`, `authTelemetry.ts`

### Por que isso quebra Wi-Fi (não 4G)

Numa Wi-Fi residencial com latência moderada (60–200 ms) e bandwidth limitado, o dashboard dispara ~15–25 queries em paralelo no boot. Cenário real:

1. **Dois fetch wrappers empilhados** (`customClient` telemetry + `fetchCircuitBreaker`) — toda request passa por dois interceptadores antes de sair
2. **Timeout duro de 15s via AbortController** — uma query KPI grande que naturalmente levaria 8–12 s em Wi-Fi pode ser abortada se o servidor está sob carga, virando `AbortError` e contando como falha
3. **5 falhas em 30 s = "offline"** — fácil de atingir no boot de um dashboard pesado em Wi-Fi
4. **Banner aparece em 1.5 s** — corretor vê "Conexão indisponível" mesmo a rede funcionando
5. **Telemetria de cada falha dispara MAIS fetches** para `network_telemetry`, amplificando o problema sob estresse de rede
6. **SW kill switch força reload com cache-bust em toda activate** — em vez do PWA antigo que servia shell instantâneo do cache, agora cada visita refaz download completo

Em 4G/5G a latência baixa e bandwidth alta absorvem tudo. Em Wi-Fi residencial, o efeito combinado faz o boot parecer "servidor offline" mesmo a rede estando OK.

## A solução real

Restaurar a arquitetura comprovada de pré-13/05 nos pontos que introduziram fragilidade, mas mantendo o que de fato resolveu problemas reais.

### Camada 1 — Remover interceptação global de rede (raiz do problema em Wi-Fi)

| Arquivo | Ação | Por quê |
|---|---|---|
| `src/lib/fetchCircuitBreaker.ts` | **Deletar** + remover `installFetchCircuitBreaker()` de `main.tsx` | Patching de `window.fetch` global com timeout 15s aborta requests legítimas em Wi-Fi |
| `src/lib/originalFetch.ts` | **Deletar** | Só existia para dar fallback ao circuit breaker |
| `src/lib/apiHealth.ts` | **Deletar** | Detector com thresholds que disparam falso-positivo em Wi-Fi |
| `src/components/ApiOfflineBanner.tsx` | **Deletar** + remover do layout | Mostra "Conexão indisponível" baseado em apiHealth |
| `src/lib/networkTelemetry.ts` | **Deletar** + remover wrapper de fetch do `customClient.ts` | Loga em `network_telemetry` e amplifica carga sob estresse |
| `src/lib/authTelemetry.ts`, `src/lib/authHealthMonitor.ts` | **Deletar** se não tiverem outros consumidores | Mesma motivação |

### Camada 2 — Voltar a um único cliente Supabase

| Arquivo | Ação |
|---|---|
| `src/integrations/supabase/customClient.ts` | **Deletar** |
| `src/integrations/supabase/client.ts` | Restaurar versão pré-13/05 (importa env vars direto, sem `edgeBaseUrl`) |
| Todo `import { supabase } from "@/integrations/supabase/customClient"` | Reescrever para `"@/integrations/supabase/client"` (estimativa: 60–120 arquivos, busca + replace mecânico) |
| `src/lib/edgeBaseUrl.ts`, `src/lib/storageUrl.ts` | Manter apenas como helpers estáticos apontando para o host direto (sem lógica dinâmica) |

### Camada 3 — Simplificar `main.tsx` e `useAuth.tsx`

| Arquivo | Ação |
|---|---|
| `src/main.tsx` | Reduzir aos essenciais: createRoot + kill switch one-shot (mantém) + version polling 60s (mantém — útil) + flags de recovery (mantém — link de recuperação útil). **Remover**: `installFetchCircuitBreaker`, import do `originalFetch`, cleanup de chaves antigas (já não há mais nada para limpar) |
| `src/hooks/useAuth.tsx` | Comparar com versão pré-13/05 (150 linhas) e remover camadas de retry/telemetria/health monitor que não foram pedidas. Manter apenas: signIn, signOut, session listener, role resolution. Estimativa final: ~180–220 linhas |
| `public/sw.js` | Restaurar Stale-While-Revalidate de `ef30ac4e` (172 linhas). PWA volta a abrir instantâneo do cache. **Manter** o handler de push notifications atual (foi adicionado depois e funciona) |

### Camada 4 — `/admin/diagnostico-rede`

Simplificar para apenas mostrar:
- Health probe ao host direto
- Health probe ao proxy (diagnóstico, não failover)
- Latência de cada um
- Sem botões de "forçar host" (não há mais hostFailover)

## O que é mantido (porque resolveu problemas reais)

- ✅ DNS Cloudflare em `api.uhomesales.com` e `realtime.uhomesales.com` — usado por integrações server-side (Make, RD Station, Meta Ads, site)
- ✅ SW kill switch one-shot (`src/lib/swKillSwitch.ts`) — útil para limpar SW antigo de quem ainda tem cache da versão velha. Roda 1x por usuário e morre.
- ✅ Version polling em `main.tsx` — força reload quando há deploy novo. Útil.
- ✅ Recovery flags (`?_recover=1`) — link de emergência funciona.
- ✅ Push notifications no SW — handler atual está OK.
- ✅ Todas as features de produto, edge functions, RLS, schema do banco.

## Bateria de testes obrigatória

### B.1 Estática
- TypeScript zero erros
- `bunx vitest run` — 6/6 passa
- `grep -r "customClient\|fetchCircuitBreaker\|apiHealth\|ApiOfflineBanner\|networkTelemetry"` em `src/` retorna **zero** ocorrências
- Bundle size diff: comparar `dist/` antes vs depois — espera-se redução

### B.2 Runtime no preview Lovable
- `/auth` carrega instantâneo
- Login funciona
- Dashboard carrega sem nenhum banner de "conexão"
- Console limpo (sem `[killswitch]`, `[apiHealth]`, etc.)
- Network tab: cada request Supabase vai direto, **sem wrapper**, sem timeout artificial
- Realtime conecta no host direto

### B.3 Runtime publicado (uhomesales.com)
- Login em 4G ✅
- Login em **Wi-Fi do teste de hoje** (que falhou) — tem que funcionar como funcionava 3 meses atrás
- PWA instalado abre instantâneo do cache (SW restaurado)
- Push notifications continuam recebendo

### B.4 Smoke
- 1 cron de edge function executa OK (lead-escalation)
- 1 lead novo entra pela roleta
- 1 mensagem WhatsApp dispara

### B.5 Reversibilidade
- Branch antes de aplicar (snapshot Lovable serve)
- Em 24h sem reportes negativos: deletar arquivos órfãos definitivamente

## Risco

**Estimativa de impacto**: 60–120 arquivos importam `customClient`. A reescrita é mecânica (sed). Risco de regressão em features de produto: baixo, porque o cliente exposto continua sendo o mesmo objeto Supabase, só vindo de outro arquivo.

**O que pode dar errado**: algum hook usa funcionalidade específica de `customClient` (ex: `useAuth.tsx` pode estar acoplado ao `setTelemetryIdentity`). Vou auditar dependências antes de deletar — se houver, isolo a função e deleto só o resto.

## Resultado esperado

Arquitetura idêntica em comportamento à de **13/05 18:55 BRT** — a versão que rodou 3 meses sem nenhum corretor reportar Wi-Fi quebrada. Apenas com:
- DNS Cloudflare de domínio próprio (apenas server-side)
- Push notifications ativas
- Kill switch + version polling como rede de segurança para deploys

Sem fetch wrappers. Sem detector de "offline" agressivo. Sem banner que assusta o corretor. Sem segundo cliente Supabase concorrente.
