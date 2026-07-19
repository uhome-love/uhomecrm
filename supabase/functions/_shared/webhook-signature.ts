/**
 * _shared/webhook-signature.ts — Helpers de verificação de assinatura HMAC
 * para webhooks (Meta/WhatsApp, Mailgun, e futuros).
 *
 * Usado em modo log-only (auditoria de segurança, 19/07/2026): valida a
 * assinatura mas não bloqueia a requisição — apenas registra em
 * `ops_events` quando ausente/inválida, seguindo o mesmo padrão já usado
 * no evolution-webhook. Enforcement real (HTTP 401) é uma fase separada,
 * a liberar depois de um período de observação.
 */

/** Calcula HMAC-SHA256 de `message` com `secret`, retorna hex lowercase. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparação em tempo constante entre duas strings hex/ascii de mesmo tamanho esperado. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Registra (best-effort, nunca lança) um evento de auditoria de auth ausente/inválida. */
export async function logAuthMissing(
  supabaseUrl: string,
  serviceRoleKey: string,
  fn: string,
  message: string,
  ctx: Record<string, unknown>,
): Promise<void> {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supa = createClient(supabaseUrl, serviceRoleKey);
    await supa.from("ops_events").insert({
      fn,
      level: "warn",
      category: "security",
      message,
      ctx,
    });
  } catch (_e) {
    // best-effort — nunca derruba o webhook por causa de log
  }
}
