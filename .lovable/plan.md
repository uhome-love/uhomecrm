# Plano final — eliminar "Failed to fetch" no CRM

Objetivo: você nunca mais ver `Failed to fetch`, "Erro ao carregar leads", ou ser deslogado por uma falha de rede transitória. Solução em 3 camadas: **Frontend (failover automático)** + **Cloudflare (Manus)** + **Diagnóstico permanente**.

---

## Diagnóstico atual (o que está acontecendo)

Os logs de rede mostram que TODAS as requests `Failed to fetch` partem do **iframe de preview do Lovable** (`lovableproject.com`). No app publicado (`uhomeia.lovable.app` / `uhomesales.com`), o backend responde normalmente.

Existem **dois problemas distintos** que precisam tratamento separado:

| Problema | Onde acontece | Causa | Solução |
|---|---|---|---|
| `Failed to fetch` no preview do Lovable | só dentro do iframe `lovable.dev` | proxy `lovable.js` intercepta fetch de auth | **não tem fix nosso** — usar a URL publicada para trabalhar |
| Quedas reais em Claro / hotspot | usuários finais | Cloudflare WAF/Bot/Cache + ausência de failover | Frente A (Cloudflare via Manus) + Frente B (failover automático no frontend) |

A Frente A do Cloudflare já foi aplicada pelo Manus (Config Rule, Cache Rule, WAF Skip nos 4 hosts). Falta o **failover automático** no frontend e os **ajustes finais** que só o Manus consegue (Bot Fight Mode, IPv6, hosts de backup).

---

## FRENTE 1 — Frontend: failover automático e resiliente

### 1.1 Interceptor de fetch com failover real
Reescrever `fetchCircuitBreaker.ts` para virar um **smart fetch**:

- Detecta requests para `api.uhomesales.com` / `realtime.uhomesales.com`.
- Em **`TypeError: Failed to fetch`**, **timeout >15s**, ou **5xx** → retry com backoff exponencial (300ms, 800ms, 2s).
- Após **2 falhas consecutivas em <30s**, reescreve o host na hora para `api-backup.uhomesales.com` (transparente, sem reload).
- Marca `sessionStorage` para sticky no backup; testa a cada 5min se o primary voltou (probe `/auth/v1/health`) e volta automaticamente.
- Nunca lança `Failed to fetch` cru pra UI — só após esgotar retries+backup.

### 1.2 Realtime com auto-reconnect no backup
Atualizar `customClient.ts`:
- Listener em `supabase.realtime.onError` → se desconectar 2x em 30s, troca `endPoint` para `realtime-backup.uhomesales.com` e reconecta.
- Idem probe de retorno ao primary.

### 1.3 Camada de UX — sumir com mensagens cruas
- `ApiOfflineBanner` só aparece após **8s sustentados** sem rede confirmada (não pisca em blip de 1s).
- Toast genérico "Recarregando..." substitui qualquer `toast.error('Erro ao carregar leads')` quando a causa for rede (detectado pelo smart fetch).
- Hooks de leads/dashboard recebem flag `isNetworkError` → mostram skeleton + botão "Tentar de novo" em vez de "0 leads" ou erro vermelho.

### 1.4 Proteção de sessão (já existe, validar)
`useAuth` e `useUserRole` **NÃO podem** rebaixar cargo nem deslogar em `Failed to fetch`. Já está implementado — só validar que continua intacto após as mudanças.

---

## FRENTE 2 — O que o Manus precisa fazer no Cloudflare

Texto pronto para colar pro Manus:

> **Pendências Cloudflare zona `uhomesales.com` para fechar o caso:**
>
> 1. **Bot Fight Mode**: confirmar se está **OFF globalmente** na zona (Skip Rule não cobre BFM no plano Free, conforme docs). Se a zona estiver em plano Free e BFM estiver ON, desligar. Se já estiver OFF, confirmar por print.
> 2. **AAAA / IPv6** dos 4 hosts (`api`, `realtime`, `api-backup`, `realtime-backup`): listar registros AAAA atuais e **remover qualquer AAAA não-proxied**. Se houver AAAA proxied, manter, mas confirmar que o Worker responde por IPv6 sem 522/525.
> 3. **SSL/TLS mode**: confirmar **Full (strict)** na zona; se estiver em "Flexible" ou "Full", subir para Full (strict).
> 4. **Worker (`uhomesales-supabase-proxy`)**: confirmar que repassa **sem reescrever** os headers `Authorization`, `apikey`, `x-client-info`, `Content-Type`, `Prefer`, `Range`, `Accept-Profile`, `Content-Profile`, e que NÃO injeta `cf-connecting-ip` no path interno do Supabase de forma que quebre RLS.
> 5. **Worker timeout**: subir `cpu_ms` e `subrequest timeout` para o máximo permitido no plano (Workers Free = 10ms CPU; se possível, mover para **Workers Paid (Bundled)** com 50ms para suportar bursts de 100+ req simultâneas do dashboard CEO).
> 6. **Página de status pública**: criar rota `https://api.uhomesales.com/__health` no Worker que responde `200 {ok:true}` direto, sem chamar o Supabase. Usaremos no frontend pra distinguir "Cloudflare caiu" de "Supabase caiu".
> 7. **Rotacionar a Global API Key** usada na execução anterior e gerar um **API Token escopado** apenas à zona `uhomesales.com` com permissões: `Zone:DNS:Edit`, `Zone:Workers Routes:Edit`, `Zone:Zone Settings:Edit`, `Account:Workers Scripts:Edit`, `Zone:Rulesets:Edit`. Enviar o novo token cifrado.
> 8. **Print final** dos rulesets ativos e do BFM/IPv6/SSL pra anexar no runbook.

---

## FRENTE 3 — Diagnóstico permanente

- **Página `/diagnostico-rede`** (admin only): mostra status em tempo real do primary, backup, latência, último switch, e botão "Forçar primary/backup/probe".
- **Telemetria**: cada switch primary↔backup grava em `audit_log` com `acao=proxy_switch`, target, motivo (timeout/failed-fetch/5xx), userAgent. Permite ver depois se a Claro/hotspot ainda está degradando.
- **Memory entry**: atualizar `mem://arquitetura/proxy-cloudflare-supabase` com a arquitetura final dual-host + failover.

---

## Critério de aceite (você consegue testar)

Na rede Claro **e** no hotspot, abrindo `https://uhomesales.com`:

1. Login funciona em ≤3s.
2. Dashboard carrega leads sem erro vermelho.
3. Se desligar Wi-Fi por 5s e religar, app continua sem deslogar e sem zerar dados.
4. DevTools → Network: zero requests para `*.supabase.co`. Todas em `*.uhomesales.com`.
5. Se o primary ficar fora, requests migram automaticamente para `api-backup` em ≤4s, sem reload, sem perder sessão.
6. Nenhum toast "Failed to fetch" / "Erro ao carregar leads" durante operação normal.

---

## Detalhes técnicos (para mim implementar)

```text
src/lib/
├─ proxyEndpoints.ts       # já existe, manter
├─ smartFetch.ts           # NOVO — interceptor com retry+failover
├─ apiHealth.ts            # já existe, ampliar com probe primary
└─ realtimeFailover.ts     # NOVO — watchdog do WebSocket

src/integrations/supabase/
└─ customClient.ts         # ler endpoint via getActiveEndpoints()

src/hooks/
└─ useNetworkAwareQuery.ts # NOVO — wrapper que distingue erro de rede vs erro real

src/pages/admin/
└─ DiagnosticoRede.tsx     # NOVO — painel diagnóstico
```

Backoff: 300ms → 800ms → 2s → switch backup. Probe de volta ao primary: GET `/__health` a cada 5min. Sticky backup expira em 30min.

---

## Ordem de execução

1. **Você**: enviar o bloco da **Frente 2** pro Manus aplicar.
2. **Eu** (em paralelo): implementar Frente 1 e Frente 3.
3. Após Manus confirmar os 8 itens + o frontend deployado: você testa na Claro + hotspot seguindo os 6 critérios de aceite.
4. Atualizo a memória do projeto com a arquitetura final.

Quando aprovar, começo pela Frente 1 (smart fetch + failover) — é o que mais impacta usuário final hoje.