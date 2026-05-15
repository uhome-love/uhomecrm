# Reversão à arquitetura estável + bateria completa de testes

## Contexto crítico (DNS Cloudflare)
Recentemente o domínio `api.uhomesales.com` (e `realtime.uhomesales.com`) foi configurado via Cloudflare como proxy para o Supabase. Esse setup **continua existindo no DNS** e é o que estamos retirando do runtime do app — mas **não vamos mexer nele no Cloudflare**. O domínio continua publicado e funcional para quem quiser bater nele direto via curl/diagnóstico. Apenas o **frontend** deixa de depender dele.

Isso é importante porque:
- Edge Functions, webhooks externos (Make.com, RD Station, ImovelWeb, Meta Ads, site uhomesales.com) podem continuar usando `api.uhomesales.com` se já estiverem configurados assim — **não vamos quebrar nada server-side**.
- O painel `/diagnostico-rede` continuará podendo testar manualmente o proxy para fins de monitoramento, só não vai mais flipar host automaticamente.

## Objetivo
Voltar o runtime de rede do **frontend** ao estado anterior ao commit `2467346c` (14/05 18:10 UTC), quando 100% dos provedores funcionavam. Eliminar todo proxy + failover bidirecional + flips em localStorage **do cliente**, sem tocar no DNS Cloudflare nem em integrações server-side.

## Princípio
**Frontend usa um único host canônico em runtime: `hunbxqzhvuemgntklyzb.supabase.co`** (direto). Sem proxy, sem failover, sem reescrita de URL, sem flip.

---

## Fase A — Remoção cirúrgica do proxy do runtime frontend

### 1. `src/integrations/supabase/customClient.ts` — simplificar
- Substituir `getCurrentApiBase()` por `https://hunbxqzhvuemgntklyzb.supabase.co` fixo
- Remover bloco de Realtime watchdog que escuta `host:flipped`
- Manter: auth config (lock no-op), wrapper de telemetria de fetch (apenas observação), identidade leve

### 2. `src/lib/fetchCircuitBreaker.ts` — simplificar
- Remover toda lógica de reescrita para host alternativo e imports de `hostFailover`
- Manter apenas: timeout 15s, retry com backoff em 5xx (300ms, 800ms), telemetria via `apiHealth`

### 3. `src/lib/hostFailover.ts` — DELETAR
Módulo inteiro deixa de existir.

### 4. `src/lib/edgeBaseUrl.ts` — fixar host direto
Sempre retornar `https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1`.

### 5. `src/lib/networkTelemetry.ts` — fixar host direto
Sem dependência de `hostFailover`.

### 6. `src/lib/storageUrl.ts` — fixar host direto
Reescrita de URL pública de Storage usa só o host direto.

### 7. `src/pages/admin/DiagnosticoRede.tsx` — manter como ferramenta de monitoria
- **Manter** os probes manuais para `api.uhomesales.com` e `hunbxqzhvuemgntklyzb.supabase.co` (útil para diagnosticar problemas de DNS de corretores)
- **Remover** os botões que pinam host em localStorage e a leitura/escrita de `uhome:host:pinned`
- O painel vira read-only de saúde dos dois endpoints, sem efeito colateral no app

### 8. `src/main.tsx` — limpeza one-shot no boot
Bloco que faz `localStorage.removeItem("uhome:host:pinned")` e `localStorage.removeItem("uhome:host:flips")` uma única vez. Garante que dispositivos que já flipou para `proxy` durante as últimas horas voltem ao direto sem ação manual.

### 9. Memória do projeto
Substituir Core "Runtime 15/05/2026 v3 — FAILOVER BIDIRECIONAL..." por:
> "Runtime 15/05/2026 v4 — DIRETO ÚNICO: todo o tráfego frontend vai direto para `hunbxqzhvuemgntklyzb.supabase.co`. Sem proxy próprio, sem failover de host, sem `hostFailover.ts`. DNS Cloudflare em `api.uhomesales.com` continua publicado para integrações server-side e diagnóstico, mas não é usado em runtime do app. Não reintroduzir `api.uhomesales.com` no frontend sem validação ponta-a-ponta."

Atualizar `mem://arquitetura/proxy-cloudflare-supabase` marcando que é apenas server-side / diagnóstico.

---

## Fase B — Bateria completa de testes (obrigatória antes de fechar)

### B.1 Testes estáticos
- Build limpo (sem erros TypeScript, sem imports quebrados de `hostFailover`)
- Grep no `src/` para garantir zero referência a `api.uhomesales.com`, `realtime.uhomesales.com`, `getCurrentApiBase`, `hostFailover`, `getPinnedHost`, `flipHost` fora de `DiagnosticoRede.tsx`
- Grep para garantir que `customClient.ts` é a ÚNICA porta de entrada do Supabase no frontend (regra Core de memória)

### B.2 Testes de runtime no preview (browser tool)
1. **Carregar `/auth`** → confirmar que a tela de login renderiza sem erros no console
2. **Inspecionar requests de rede** → confirmar que TODAS as chamadas saem em `hunbxqzhvuemgntklyzb.supabase.co` e ZERO em `api.uhomesales.com` ou `realtime.uhomesales.com`
3. **Login** com credencial real (pedir ao usuário se não houver disponível)
4. **Pós-login**: navegar para `/index`, `/pipeline`, `/oferta-ativa`, `/whatsapp/inbox` — confirmar que cada tela carrega dados sem erro 401/403/Failed to fetch
5. **Realtime**: abrir uma tela com subscription (inbox WhatsApp) e validar que conecta no WebSocket do host direto
6. **Storage**: abrir uma tela com fotos (vitrine ou imóvel) e confirmar que carregam do host direto
7. **Edge Functions**: disparar uma chamada (ex.: `log-auth-event` no boot) e confirmar 200 no host direto
8. **localStorage**: abrir DevTools → Application → confirmar que `uhome:host:pinned` e `uhome:host:flips` foram removidos no boot

### B.3 Diagnóstico de saúde
- Abrir `/diagnostico-rede` (admin) → confirmar que ambos os probes (proxy e direto) ainda funcionam como diagnóstico, mas que NÃO há mais botão de "forçar host"
- Confirmar zero auto-flip no console

### B.4 Validação de regressão funcional
- Confirmar que kill switch do SW continua ativo (cache vazio em DevTools)
- Confirmar que push notifications, auth refresh e BRT timezone continuam funcionando (smoke test rápido em cada)

### B.5 Validação cross-network (manual, após deploy)
Pedir confirmação ao usuário ou a um corretor de cada cenário:
- 4G/5G → deve funcionar (sempre funcionou)
- Wi-Fi Vivo Fibra → deve voltar a funcionar (era o caso quebrado)
- Wi-Fi Claro/Oi → deve continuar funcionando

---

## O que NÃO vai mudar
- DNS Cloudflare (`api.uhomesales.com`, `realtime.uhomesales.com`) — **fica intacto**
- Service Worker (`public/sw.js`) — kill switch atual fica
- Auth/login flow (`useAuth.tsx`, `Auth.tsx`)
- Edge functions (todas continuam com seu config atual)
- Schema do banco, RLS, qualquer coisa server-side
- WhatsApp, roleta, pipeline, qualquer feature de produto
- Integrações externas que apontam para `api.uhomesales.com` (Make, RD Station, etc.)

## Resultado esperado
- Zero requests do **frontend** para `api.uhomesales.com` ou `realtime.uhomesales.com`
- Zero estado mutável de host em localStorage
- Comportamento idêntico em Wi-Fi residencial Vivo/Claro e em 4G/5G
- DNS Cloudflare segue ativo para integrações server-side e diagnóstico
- Código de rede ~70% menor

## Risco controlado
Se algum corretor estiver numa rede que bloqueia `*.supabase.co` (cenário do teste pontual de hoje à noite), ele continuará precisando trocar DNS para 1.1.1.1 — mas era a situação pré-14/05 e funcionou para 100% da operação por semanas.

## Ordem de execução
1. Fase A (edições em paralelo onde possível)
2. Fase B.1 (testes estáticos + grep)
3. Fase B.2 a B.4 (testes runtime no preview com browser tool)
4. Reportar resultado dos testes ao usuário
5. Pedir validação cross-network (B.5) com corretor real
6. Atualizar memória do projeto
