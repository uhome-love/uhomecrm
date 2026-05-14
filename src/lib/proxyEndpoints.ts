// Endpoints próprios para Supabase via Cloudflare.
// REGRA DURA: apenas subdomínios uhomesales.com. NUNCA *.supabase.co em runtime.
// O fallback (BACKUP) só será ativado quando os hosts api-backup/realtime-backup
// existirem no Cloudflare. Até lá, o gate por sessionStorage fica desligado.

export type ProxyTarget = "primary" | "backup";

export interface ProxyEndpoints {
  api: string;
  realtime: string;
}

export const PRIMARY: ProxyEndpoints = {
  api: "https://api.uhomesales.com",
  realtime: "wss://realtime.uhomesales.com/realtime/v1",
};

// Hosts próprios — NÃO trocar para *.supabase.co.
export const BACKUP: ProxyEndpoints = {
  api: "https://api-backup.uhomesales.com",
  realtime: "wss://realtime-backup.uhomesales.com/realtime/v1",
};

const ALLOWED_HOST_SUFFIX = ".uhomesales.com";
const STORAGE_KEY = "uhome:proxy:target";

function assertOwnHost(url: string) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
      throw new Error(`Proxy endpoint must be a uhomesales.com host, got ${u.hostname}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[proxyEndpoints] invalid endpoint", url, err);
    throw err;
  }
}

assertOwnHost(PRIMARY.api);
assertOwnHost(BACKUP.api);

export function getActiveTarget(): ProxyTarget {
  if (typeof sessionStorage === "undefined") return "primary";
  const v = sessionStorage.getItem(STORAGE_KEY);
  return v === "backup" ? "backup" : "primary";
}

export function getActiveEndpoints(): ProxyEndpoints {
  return getActiveTarget() === "backup" ? BACKUP : PRIMARY;
}

export function setActiveTarget(target: ProxyTarget) {
  if (typeof sessionStorage === "undefined") return;
  const prev = getActiveTarget();
  if (prev === target) return;
  if (target === "primary") sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, "backup");
  try {
    window.dispatchEvent(new CustomEvent("proxy:switched", { detail: { target } }));
  } catch {
    // noop
  }
}
