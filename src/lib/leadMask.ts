/**
 * Utilitários de máscara de PII de leads.
 * Usados no fluxo de aceite (roleta) para ocultar telefone/email
 * antes do corretor efetivamente aceitar o lead.
 */

export function firstName(nome: string | null | undefined): string {
  if (!nome) return "Lead";
  const first = nome.trim().split(/\s+/)[0];
  return first || "Lead";
}

/**
 * Mascara telefone preservando DDD quando possível.
 * Ex.: "51999998888" -> "(51) •••••-••••"
 *      "5551999998888" -> "(55) •••••-••••" (DDI+DDD ambíguo — mostra 2 primeiros)
 *      curto -> "•••••-••••"
 */
export function maskPhone(telefone: string | null | undefined): string {
  if (!telefone) return "•••••-••••";
  const digits = telefone.replace(/\D/g, "");
  if (digits.length >= 10) {
    // BR: pega DDD (posição varia com DDI 55)
    const ddd = digits.length >= 12 ? digits.slice(2, 4) : digits.slice(0, 2);
    return `(${ddd}) •••••-••••`;
  }
  return "•••••-••••";
}

/**
 * Mascara email preservando primeira letra do usuário e primeira letra do domínio.
 * Ex.: "joao.silva@gmail.com" -> "j•••@g•••.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "•••@•••";
  const [user, domain] = email.split("@");
  if (!user || !domain) return "•••@•••";
  const domainParts = domain.split(".");
  const tld = domainParts.length > 1 ? "." + domainParts.slice(1).join(".") : "";
  const domainHead = domainParts[0] || "";
  return `${user[0]}•••@${domainHead[0] || "•"}•••${tld}`;
}

/**
 * Mascara observações — mostra apenas comprimento aproximado, sem conteúdo.
 */
export function maskObservacoes(obs: string | null | undefined): string {
  if (!obs || !obs.trim()) return "";
  return "••• liberado após aceitar •••";
}
