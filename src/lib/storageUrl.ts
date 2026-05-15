// Normaliza URLs públicas de Storage para o host canônico do Supabase.
// Runtime 15/05/2026 v4 — DIRETO ÚNICO.

const DIRECT_HOST = "hunbxqzhvuemgntklyzb.supabase.co";
const DIRECT_ORIGIN = `https://${DIRECT_HOST}`;

// Hosts antigos que podem aparecer em URLs persistidas no banco.
const LEGACY_HOSTS = [
  "hunbxqzhvuemgntklyzb.supabase.in",
  "api.uhomesales.com",
  "api-backup.uhomesales.com",
];

let warnedOnce = false;

/** Reescreve a URL para o host canônico se vier de um host legado conhecido. */
export function toPublicStorageUrl<T extends string | null | undefined>(input: T): T {
  if (!input || typeof input !== "string") return input;
  let out: string = input;
  for (const host of LEGACY_HOSTS) {
    if (out.includes(host)) {
      out = out.split(host).join(DIRECT_HOST);
      if (!warnedOnce && typeof console !== "undefined") {
        warnedOnce = true;
        console.warn(`[storageUrl] host rewritten (${host} -> ${DIRECT_HOST})`);
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
  return `${DIRECT_ORIGIN}${path}`;
}
