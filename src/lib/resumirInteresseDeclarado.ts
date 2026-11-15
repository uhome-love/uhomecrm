const PREFIXO = /^interesse declarado:\s*/i;

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Resume "Interesse declarado: ..." para caber em títulos curtos. Outros nomes voltam iguais. */
export function resumirInteresseDeclarado(nome: string): string {
  if (!PREFIXO.test(nome)) return nome;
  const corpo = nome.replace(PREFIXO, "").trim();
  const [antesEm, ...resto] = corpo.split(/\s+em\s+/i);
  const bairros = resto.join(" em ").trim();
  const partes = antesEm.split(",").map((p) => p.trim()).filter(Boolean);
  const tipos = (partes[0] || "").split("/").map((t) => t.trim()).filter(Boolean);
  const preco = partes.find((p) => /r\$/i.test(p));

  const out: string[] = [];
  if (tipos.length) out.push(cap(tipos[0]) + (tipos.length > 1 ? ` +${tipos.length - 1} tipos` : ""));
  if (bairros) {
    const bs = bairros.split(/\s+/);
    // bairros vêm separados por espaço; nomes compostos ficam na contagem aproximada
    out.push(bs.length > 1 && !/porto alegre|canoas/i.test(bairros) ? `${bs[0]} +mais` : bairros);
  }
  if (preco) out.push(preco);
  return `Interesse do site · ${out.join(" · ") || corpo}`;
}
