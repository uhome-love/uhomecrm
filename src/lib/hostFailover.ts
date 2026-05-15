/**
 * Host failover bidirecional — runtime canônico 15/05/2026.
 *
 * PROBLEMA REAL:
 *   - Provedor A (ex.: Vivo Fibra) NÃO resolve `api.uhomesales.com` (DNS NXDOMAIN).
 *   - Provedor B (outro Wi-Fi residencial) NÃO resolve `*.supabase.co` (bloqueio de DNS).
 *   - Nenhuma escolha estática serve aos dois grupos.
 *
 * SOLUÇÃO:
 *   - Mantemos DOIS candidatos: `proxy` (api.uhomesales.com) e `direct` (supabase.co).
 *   - O host "pinado" fica em localStorage e sobrevive entre sessões.
 *   - O `fetchCircuitBreaker` detecta TypeError (falha de DNS/rede) e troca de host
 *     automaticamente. A próxima request já sai no host que funciona.
 *   - O Realtime escuta o evento `host:flipped` e reconecta no novo host.
 *
 * REGRA: nunca mudar o pinned host fora deste módulo. A flip só pode ocorrer
 * via `flipHost()` chamado pelo circuit breaker em resposta a falha real.
 */

export type HostId = "proxy" | "direct";

const STORAGE_KEY = "uhome:host:pinned";

const HOSTS: Record<HostId, { api: string; realtime: string }> = {
  proxy: {
    api: "api.uhomesales.com",
    realtime: "realtime.uhomesales.com",
  },
  direct: {
    api: "hunbxqzhvuemgntklyzb.supabase.co",
    realtime: "hunbxqzhvuemgntklyzb.supabase.co",
  },
};

// Default: `proxy`. Histórico mostra que api.uhomesales.com (Cloudflare anycast)
// resolve em mais provedores no Brasil que *.supabase.co. Nos provedores onde
// não resolve, o circuit breaker troca para `direct` na primeira falha.
const DEFAULT_HOST: HostId = "proxy";

export function getPinnedHost(): HostId {
  try {
    const v = (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null) as
      | HostId
      | null;
    if (v === "proxy" || v === "direct") return v;
  } catch {
    // noop
  }
  return DEFAULT_HOST;
}

function setPinnedHost(h: HostId) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, h);
  } catch {
    // noop
  }
}

export function getAlternateHost(h: HostId = getPinnedHost()): HostId {
  return h === "proxy" ? "direct" : "proxy";
}

export function getCurrentApiBase(): string {
  return `https://${HOSTS[getPinnedHost()].api}`;
}

export function getCurrentRealtimeUrl(): string {
  return `wss://${HOSTS[getPinnedHost()].realtime}/realtime/v1`;
}

export function getApiBaseFor(h: HostId): string {
  return `https://${HOSTS[h].api}`;
}

export function getRealtimeUrlFor(h: HostId): string {
  return `wss://${HOSTS[h].realtime}/realtime/v1`;
}

/** Retorna a lista de TODOS os hostnames de API conhecidos (proxy + direct). */
export function getAllKnownApiHostnames(): string[] {
  return [HOSTS.proxy.api, HOSTS.direct.api];
}

/**
 * Identifica em qual host pertence um hostname (api ou realtime),
 * para o fetch interceptor saber se deve aplicar failover.
 */
export function identifyHost(hostname: string): HostId | null {
  if (hostname === HOSTS.proxy.api || hostname === HOSTS.proxy.realtime) return "proxy";
  if (hostname === HOSTS.direct.api || hostname === HOSTS.direct.realtime) return "direct";
  return null;
}

/**
 * Reescreve uma URL trocando o hostname do host A para o host B.
 * Funciona tanto para api quanto para realtime.
 */
export function rewriteUrlToHost(url: string, target: HostId): string {
  try {
    const u = new URL(url);
    const isRealtime = u.hostname === HOSTS.proxy.realtime || u.hostname === HOSTS.direct.realtime;
    u.hostname = isRealtime ? HOSTS[target].realtime : HOSTS[target].api;
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Troca o host pinado para o alternativo e dispara evento `host:flipped`.
 * O Realtime watchdog escuta e reconecta. Idempotente: se já está no alvo, no-op.
 */
export function flipHost(reason: string): HostId {
  const current = getPinnedHost();
  const next = getAlternateHost(current);
  setPinnedHost(next);

  // eslint-disable-next-line no-console
  console.warn(`[hostFailover] flip ${current} -> ${next} (reason: ${reason})`);

  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("host:flipped", { detail: { from: current, to: next, reason } }),
      );
    }
  } catch {
    // noop
  }

  // Log local leve (auditável em /diagnostico-rede se existir)
  try {
    if (typeof localStorage !== "undefined") {
      const KEY = "uhome:host:flips";
      const log: any[] = JSON.parse(localStorage.getItem(KEY) || "[]");
      log.unshift({ from: current, to: next, reason, ts: new Date().toISOString() });
      localStorage.setItem(KEY, JSON.stringify(log.slice(0, 30)));
    }
  } catch {
    // noop
  }

  return next;
}

/** Força um host específico (uso manual via diagnóstico). */
export function pinHost(h: HostId, reason = "manual"): void {
  const current = getPinnedHost();
  if (current === h) return;
  setPinnedHost(h);
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("host:flipped", { detail: { from: current, to: h, reason } }),
      );
    }
  } catch {
    // noop
  }
}
