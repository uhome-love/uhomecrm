// Normaliza URLs públicas de Storage para o host canônico do backend.
//
// Regra atual (15/05/2026): runtime crítico do CRM usa o host direto do
// backend. Não reescrevemos mais para api.uhomesales.com porque o domínio
// próprio sofre falhas de resolução DNS em alguns provedores Wi-Fi.

const CANONICAL_STORAGE_ORIGIN = "https://hunbxqzhvuemgntklyzb.supabase.co";
const LEGACY_PROXY_HOSTS = [
  "api.uhomesales.com",
  "api-backup.uhomesales.com",
];
const LEGACY_SUPABASE_IN_HOST = "hunbxqzhvuemgntklyzb.supabase.in";

let warnedOnce = false;

/**
 * Devolve a URL apontando para o host canônico do backend.
 * - Se já estiver no host canônico, retorna como está.
 * - Se contiver host legado (proxy próprio ou .supabase.in), reescreve.
 * - Se receber `null`/`undefined`/string vazia, devolve o valor original.
 */
export function toPublicStorageUrl<T extends string | null | undefined>(input: T): T {
  if (!input || typeof input !== "string") return input;
  let out: string = input;
  const hostsToRewrite = [...LEGACY_PROXY_HOSTS, LEGACY_SUPABASE_IN_HOST];
  for (const host of hostsToRewrite) {
    if (out.includes(host)) {
      out = out.split(host).join("hunbxqzhvuemgntklyzb.supabase.co");
      if (!warnedOnce && typeof console !== "undefined") {
        warnedOnce = true;
        console.warn(`[storageUrl] legacy host rewritten (${host} -> hunbxqzhvuemgntklyzb.supabase.co)`);
      }
    }
  }
  return out as unknown as T;
}

/** Garante que a URL final use o host canônico, mesmo se vier sem host (path puro). */
export function ensurePublicStorageUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  const normalized = toPublicStorageUrl(pathOrUrl)!;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const path = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${CANONICAL_STORAGE_ORIGIN}${path}`;
}
