/**
 * Código do candidato (auditoria 10/11/2026): só quem criou a ficha na página /vaga
 * recebe o código e pode atualizá-la. Sem código válido, ninguém altera ficha alheia
 * só sabendo o ID ou o telefone.
 */
async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`rh-candidato:${msg}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function segredo(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

export async function tokenCandidato(id: string): Promise<string> {
  return hmacHex(segredo(), id);
}

export async function tokenCandidatoValido(id: string, token: unknown): Promise<boolean> {
  if (!id || typeof token !== "string" || token.length !== 64 || !segredo()) return false;
  const esperado = await hmacHex(segredo(), id);
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
