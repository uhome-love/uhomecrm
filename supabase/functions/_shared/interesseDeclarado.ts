// Interesse declarado: quando a resposta em texto livre cita uma cidade diferente
// do produto da mensagem (ou pede algo genérico), não força o empreendimento.
const REGIOES: Array<{ nome: string; re: RegExp }> = [
  { nome: "Porto Alegre", re: /\b(poa|porto\s*alegre)\b/i },
  { nome: "Canoas", re: /\bcanoas\b/i },
];

export function regiaoDoProduto(produto: string | null | undefined): string | null {
  if (!produto) return null;
  return /canoas/i.test(produto) ? "Canoas" : "Porto Alegre";
}

/** Retorna o texto de interesse declarado, ou null se o produto da mensagem deve ser mantido. */
export function interesseDeclarado(texto: string, produto: string | null, tipoResposta: "botão" | "texto"): string | null {
  if (tipoResposta !== "texto" || !texto) return null;
  const citadas = REGIOES.filter((r) => r.re.test(texto)).map((r) => r.nome);
  if (citadas.length === 0) return null;
  const doProduto = regiaoDoProduto(produto);
  if (doProduto && citadas.includes(doProduto)) return null;
  return `Interesse declarado: imóvel em ${citadas.join(" / ")}`;
}
