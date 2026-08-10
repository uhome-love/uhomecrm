// phone — helpers de telefone para o corretor trabalhar do WhatsApp/telefone.
// O corretor conversa fora do CRM; a tela só precisa facilitar o disparo.

/** só os dígitos do telefone */
export function digitsOnly(tel?: string | null): string {
  return (tel ?? "").replace(/\D/g, "");
}

/** número com DDI 55 para wa.me / tel. Assume Brasil quando falta o país. */
export function e164BR(tel?: string | null): string | null {
  let d = digitsOnly(tel);
  if (!d) return null;
  // remove zeros/DDD-internacional bobos e normaliza
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  // 10 (fixo DDD+8) ou 11 (celular DDD+9) → prefixa 55
  if (d.length === 10 || d.length === 11) d = "55" + d;
  // já veio com 55 (12/13 dígitos) → mantém
  return d;
}

/** link wa.me pronto (ou null se telefone inválido) */
export function waLink(tel?: string | null): string | null {
  const e = e164BR(tel);
  return e && e.length >= 12 ? `https://wa.me/${e}` : null;
}

/** link tel: para discar no mobile */
export function telLink(tel?: string | null): string | null {
  const e = e164BR(tel);
  return e ? `tel:+${e}` : (digitsOnly(tel) ? `tel:${digitsOnly(tel)}` : null);
}

/** número formatado bonitinho para exibir: (51) 99999-9999 */
export function formatPhoneBR(tel?: string | null): string {
  const e = e164BR(tel);
  if (!e) return "";
  const local = e.startsWith("55") ? e.slice(2) : e;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return tel ?? "";
}
