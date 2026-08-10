// ─────────────────────────────────────────────────────────────────
// limparRegistro — deixa o "último registro" apresentável no card.
//  1) Dump de formulário (Anúncio + Respostas...) → "Anúncio: X · Casa 3 dorms · 130m²"
//  2) Vocabulário: "Tarefa" → "Lembrete" (nunca "tarefa" na UI do corretor).
// Textos curtos/normais passam quase intactos.
// ─────────────────────────────────────────────────────────────────

/** Limpa uma tipologia crua tipo "casa_3_dorms_-_130m2" → "Casa 3 dorms · 130m²". */
function limparTipologia(s: string): string {
  const out = s
    .replace(/_/g, " ")
    .replace(/\s*[-–]\s*/g, " · ")
    .replace(/m2\b/gi, "m²")
    .replace(/\s+/g, " ")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .trim()
    .replace(/^·\s*|\s*·$/g, "")
    .trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}

export function limparRegistro(texto?: string | null): string {
  if (!texto) return "";
  const t = texto.trim();

  // 1) Dump de formulário → extrai anúncio + tipologia, descarta o boilerplate.
  if (/respostas do formul[áa]rio|message lead gerado/i.test(t)) {
    const anuncioM = t.match(/an[úu]ncio:\s*([^\n]+)/i);
    const anuncio = anuncioM
      ? anuncioM[1].replace(/[-–—]\s*c[óo]pia\s*$/i, "").trim()
      : "";

    const respostas = [...t.matchAll(/\?\s*([^\n]+)/g)].map((m) => m[1].trim());
    const tipoRaw = respostas.find((a) => /dorms?|dormit|su[íi]tes?|quartos?|m2\b|m²/i.test(a));
    const tipo = tipoRaw ? limparTipologia(tipoRaw) : "";

    const partes = [anuncio && `Anúncio: ${anuncio}`, tipo].filter(Boolean);
    return partes.join(" · ") || "Lead de formulário";
  }

  // 2) Vocabulário: "Tarefa/tarefa" → "Lembrete/lembrete".
  return t.replace(/\btarefas?\b/gi, (m) =>
    m.charAt(0) === "T" ? "Lembrete" : "lembrete"
  );
}
