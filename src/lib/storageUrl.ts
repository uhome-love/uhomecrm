// Normaliza URLs públicas de Storage para o host atualmente pinado.
//
// Regra atual (15/05/2026): runtime usa failover bidirecional. O host pinado
// é dinâmico (proxy ou direct), gerenciado por src/lib/hostFailover.ts.
// URLs de storage seguem o mesmo host das demais chamadas REST.

import { getCurrentApiBase, getAllKnownApiHostnames } from "./hostFailover";

const LEGACY_SUPABASE_IN_HOST = "hunbxqzhvuemgntklyzb.supabase.in";

let warnedOnce = false;

/**
 * Reescreve a URL para o host pinado atual.
 * - Se já estiver no host pinado, retorna como está.
 * - Se estiver em qualquer host legado conhecido, reescreve para o pinado.
 */
export function toPublicStorageUrl<T extends string | null | undefined>(input: T): T {
  if (!input || typeof input !== "string") return input;
  let out: string = input;
  const canonicalOrigin = getCurrentApiBase();
  const canonicalHost = new URL(canonicalOrigin).hostname;
  const knownHosts = [...getAllKnownApiHostnames(), LEGACY_SUPABASE_IN_HOST];

  for (const host of knownHosts) {
    if (host === canonicalHost) continue;
    if (out.includes(host)) {
      out = out.split(host).join(canonicalHost);
      if (!warnedOnce && typeof console !== "undefined") {
        warnedOnce = true;
        console.warn(`[storageUrl] host rewritten (${host} -> ${canonicalHost})`);
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
  return `${getCurrentApiBase()}${path}`;
}
