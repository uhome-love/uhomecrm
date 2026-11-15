const PREFIXO = /^interesse declarado:\s*/i;

const ABREV: Record<string, string> = {
  apartamento: "Apto",
  "casa condominio": "Casa cond.",
  "casa condomínio": "Casa cond.",
  cobertura: "Cobert.",
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function encurtarPreco(p: string): string {
  return p
    .replace(/r\$\s*/i, "")
    .replace(/\s*milh(ão|ões|oes|ao)/i, "mi")
    .replace(/\s*mil\b/i, "mil")
    .trim();
}

/** Resume "Interesse declarado: ..." para títulos curtos. Ex.: "Interesse: Apto Auxiliadora até 300mil". */
export function resumirInteresseDeclarado(nome: string): string {
  if (!PREFIXO.test(nome)) return nome;
  const corpo = nome.replace(PREFIXO, "").trim();
  const [antesEm, ...resto] = corpo.split(/\s+em\s+/i);
  const lugarTxt = resto.join(" em ").trim();
  const partes = antesEm.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
  const tipo = (partes[0] || "").split("/")[0].trim();
  const preco = partes.find((p) => /r\$/i.test(p));

  const out: string[] = [];
  if (tipo) out.push(ABREV[tipo.toLowerCase()] ?? cap(tipo));
  if (lugarTxt) {
    const cidade = lugarTxt.match(/porto alegre|canoas/i);
    out.push(cidade ? lugarTxt : lugarTxt.split(/\s+/)[0]);
  }
  if (preco) out.push(encurtarPreco(preco));
  return `Interesse: ${out.join(" ") || corpo}`;
}
