// Normaliza URLs públicas de Storage para usarem o domínio próprio (proxy Cloudflare).
// Necessário porque dados antigos no banco e algumas integrações ainda devolvem
// URLs com o host original (*.supabase.co), que pode ser bloqueado por operadoras.
//
// Uso:
//   import { toPublicStorageUrl } from "@/lib/storageUrl";
//   <img src={toPublicStorageUrl(profile.avatar_url)} />

const LEGACY_HOSTS = [
  "hunbxqzhvuemgntklyzb.supabase.co",
  "hunbxqzhvuemgntklyzb.supabase.in",
];
const PROXY_ORIGIN = "https://api.uhomesales.com";

let warnedOnce = false;

/**
 * Devolve a URL apontando para o domínio próprio.
 * - Se a URL já estiver no domínio próprio, retorna como está.
 * - Se contiver host legado do Supabase, reescreve para o proxy.
 * - Se receber `null`/`undefined`/string vazia, devolve o valor original.
 */
export function toPublicStorageUrl<T extends string | null | undefined>(input: T): T {
  if (!input || typeof input !== "string") return input;
  let out: string = input;
  for (const host of LEGACY_HOSTS) {
    if (out.includes(host)) {
      out = out.split(host).join("api.uhomesales.com");
      if (!warnedOnce && typeof console !== "undefined") {
        warnedOnce = true;
        console.warn(`[storageUrl] legacy host rewritten (${host} -> api.uhomesales.com)`);
      }
    }
  }
  return out as unknown as T;
}

/** Garante que a URL final use o proxy, mesmo se vier sem host (path puro). */
export function ensurePublicStorageUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  const normalized = toPublicStorageUrl(pathOrUrl)!;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const path = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${PROXY_ORIGIN}${path}`;
}
