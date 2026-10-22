/**
 * Regras de forma de pagamento da intermediação (fonte única no front;
 * a edge `gerar-intermediacao` replica o mesmo cálculo).
 * - zemo: cada beneficiário recebe pelo ZemoBank, sem desconto.
 * - nota_fiscal: a Uhome recebe tudo e repassa, descontando X% (padrão 10%)
 *   do valor bruto de cada beneficiário.
 * - pix: direto na conta de cada beneficiário, sem desconto.
 */
export type FormaPagamento = "zemo" | "nota_fiscal" | "pix";

export const DESCONTO_NF_PCT_PADRAO = 10;

export const FORMAS_PAGAMENTO: ReadonlyArray<{ value: FormaPagamento; label: string; descricao: string }> = [
  { value: "zemo", label: "ZemoBank", descricao: "Cada um recebe pelo Zemo" },
  { value: "nota_fiscal", label: "Nota fiscal", descricao: "Uhome recebe e repassa (−10%)" },
  { value: "pix", label: "PIX", descricao: "Direto na conta" },
];

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Empreendimento (palavras-chave) → construtora oficial. */
const CONSTRUTORAS: ReadonlyArray<[string[], string]> = [
  [["open bosque", "open arvoredo"], "Open"],
  [["mood", "shift"], "Plaenge"],
  [["the arch", "boa vista country club", "connect", "joao wallig", "skyline", "jp redencao"], "Cyrela"],
  [["montenegro"], "MRV"],
  [["gpm", "grand park moinhos"], "Melnick"],
  [["duetto"], "Morana"],
  [["lake eyre", "lake victoria"], "Multiplan"],
  [["atrio", "casa bastian", "hola"], "ABF"],
  [["las casas"], "Suelo"],
  [["salzburg"], "IAS Engenharia"],
  [["casa tua"], "Encorp"],
  [["lev"], "Giardino"],
  [["alto lindoia"], "Florença"],
  [["agapanthus"], "BR4T"],
  [["villa pietra"], "Krebs"],
  [["avulso"], "Imóvel de terceiros"],
];

export function construtoraDoEmpreendimento(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const alvo = ` ${normalizar(nome).replace(/[^a-z0-9 ]/g, " ")} `;
  for (const [chaves, construtora] of CONSTRUTORAS) {
    if (chaves.some((k) => alvo.includes(` ${k} `))) return construtora;
  }
  return null;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LinhaRepasse { nome: string; bruto: number; desconto: number; liquido: number }

export function calcularRepasse(
  credores: ReadonlyArray<{ nome: string; total: number }>,
  forma: FormaPagamento,
  pctDesconto: number = DESCONTO_NF_PCT_PADRAO,
): { linhas: LinhaRepasse[]; bruto: number; desconto: number; liquido: number } {
  const pct = forma === "nota_fiscal" ? pctDesconto : 0;
  const linhas = credores.map((c) => {
    const desconto = round2((c.total * pct) / 100);
    return { nome: c.nome, bruto: round2(c.total), desconto, liquido: round2(c.total - desconto) };
  });
  const soma = (k: keyof Omit<LinhaRepasse, "nome">) => round2(linhas.reduce((s, l) => s + l[k], 0));
  return { linhas, bruto: soma("bruto"), desconto: soma("desconto"), liquido: soma("liquido") };
}
