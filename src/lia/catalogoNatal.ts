/**
 * Catálogo da campanha Natal Chave de Ouro (fonte: base de inteligência dos empreendimentos,
 * condicoes_campanha_natal.json de 04/11/2026). Preço é volátil: vale só dentro da vigência.
 * Itens em `naoCitar` vieram marcados como não confirmados — a Lia não usa até confirmação.
 */
export const NATAL_VIGENCIA = { inicio: "2026-11-02", fim: "2026-12-18" } as const;

export type FaixaNatal = "ate_300" | "300_400" | "casas" | "alto_padrao";

export const FAIXA_ROTULO: Record<FaixaNatal, string> = {
  ate_300: "Até R$ 300 mil",
  "300_400": "R$ 300 a 400 mil",
  casas: "Casas",
  alto_padrao: "Alto padrão",
};

export interface Tipologia { nome: string; valor: number }
export interface ProdutoNatal {
  slug: string;
  nome: string;
  incorporadora: string;
  local: string;
  situacao: string;
  faixa: FaixaNatal;
  tipologias: Tipologia[];
  condicao?: string;
  liaSlug: string | null;
  pendencia?: string;
  naoCitar?: string[];
  /** Entrega confirmada pelo Lucas em 04/11/2026. */
  entrega: string;
  /** Renda de referência por tipologia (sempre dependente de entrada e FGTS). */
  rendaReferencia?: string;
}

/** Regras financeiras confirmadas pelo Lucas (04/11/2026), valem para todos os produtos. */
export const REGRAS_FINANCEIRAS = {
  entrada: "Entrada padrão de 10%, mas montamos proposta caso a caso em cada empreendimento.",
  fgts: "Pode usar FGTS. Nos empreendimentos Open depende da análise de cadastro com aprovação de crédito.",
  naoPrometer: "A Lia nunca promete aprovação de crédito.",
} as const;

export const PRODUTOS_NATAL: ProdutoNatal[] = [
  { slug: "open-bosque", nome: "Open Bosque", incorporadora: "Open Construtora", local: "Passo d'Areia, Porto Alegre", situacao: "Em obras", faixa: "ate_300",
    tipologias: [{ nome: "1 dormitório", valor: 240000 }, { nome: "2 dorm. sem vaga", valor: 269000 }, { nome: "2 dorm. com vaga", valor: 292000 }],
    condicao: "3 dormitórios esgotado.", liaSlug: "open-bosque", entrega: "Novembro de 2028" },
  { slug: "essence-canoas", nome: "Essence Canoas", incorporadora: "Ábaco Urbanizadora", local: "São José, Canoas", situacao: "Em obras", faixa: "ate_300",
    tipologias: [{ nome: "Lotes", valor: 289000 }], condicao: "Faixa de R$ 289 a 500 mil conforme o lote.", liaSlug: null,
    entrega: "Conforme e-book do empreendimento", pendencia: "Ficha montada a partir do e-book e da apresentação do time." },
  { slug: "open-arvoredo", nome: "Open Arvoredo", incorporadora: "Open Construtora", local: "Passo d'Areia, Porto Alegre", situacao: "Lançamento", faixa: "300_400",
    tipologias: [{ nome: "2 dorm. com suíte", valor: 329000 }, { nome: "3 dorm. com suíte", valor: 392000 }], liaSlug: null,
    entrega: "A confirmar", rendaReferencia: "Cerca de R$ 7.000 (2 dorm.) e R$ 9.000 (3 dorm.), conforme entrada e FGTS" },
  { slug: "skyglass-parque-moinhos", nome: "Skyglass", incorporadora: "Cyrela Goldsztein", local: "Rio Branco, Porto Alegre", situacao: "Pronto para morar", faixa: "300_400",
    tipologias: [{ nome: "Studio e 1 dorm.", valor: 369000 }], condicao: "ITBI e registro grátis + 1 ano de condomínio.", liaSlug: null,
    naoCitar: ["Fechadura digital"], entrega: "Pronto para morar" },
  { slug: "casa-tua-porto-alegre", nome: "Casa Tua Porto Alegre", incorporadora: "Encorp", local: "Alto Petrópolis, Porto Alegre", situacao: "Em obras", faixa: "casas",
    tipologias: [{ nome: "Casa 2 dorm.", valor: 520000 }, { nome: "Casa 3 dorm.", valor: 659000 }, { nome: "Casa 3 dorm. c/ terraço", valor: 750000 }],
    condicao: "Desconto no crédito associativo.", liaSlug: "casa-tua-porto-alegre", naoCitar: ["Piscina com raia"], entrega: "Abril de 2028" },
  { slug: "casa-tua-canoas", nome: "Casa Tua Canoas", incorporadora: "Encorp", local: "Marechal Rondon, Canoas", situacao: "Lançamento", faixa: "casas",
    tipologias: [{ nome: "Sobrado 3 dorm.", valor: 735000 }, { nome: "Sobrado 4 dorm.", valor: 879000 }],
    condicao: "Desconto no crédito associativo.", liaSlug: "casa-tua-canoas", entrega: "Novembro de 2029" },
  { slug: "boa-vista-country-club", nome: "Boa Vista Country Club", incorporadora: "Cyrela Goldsztein", local: "Boa Vista, Porto Alegre", situacao: "Pronto para morar", faixa: "alto_padrao",
    tipologias: [{ nome: "2 dorm. c/ varanda", valor: 849000 }, { nome: "3 dorm. c/ varanda", valor: 978000 }], liaSlug: null,
    entrega: "Pronto para morar" },
  { slug: "golden-lake", nome: "Golden Lake", incorporadora: "Multiplan", local: "Cristal, Porto Alegre", situacao: "Pronto / em obras / lançamento", faixa: "alto_padrao",
    tipologias: [{ nome: "Lake Eyre · 127 m²", valor: 2480000 }, { nome: "Lake Baikal · 197 m²", valor: 3800000 }, { nome: "Lake Victoria · 299 m²", valor: 5900000 }],
    liaSlug: "lake-baikal", entrega: "Lake Victoria pronto · Lake Eyre 2028 · Lake Baikal julho de 2030", naoCitar: ["Wellness com mais de 3.500 m²"] },
];

export function precoAPartir(p: ProdutoNatal): number {
  return Math.min(...p.tipologias.map((t) => t.valor));
}

export function formatarPreco(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  return `R$ ${Math.round(v / 1000)} mil`;
}

/** Preço só vale dentro da vigência (datas BRT no formato aaaa-mm-dd). */
export function campanhaVigente(hojeBRT: string): boolean {
  return hojeBRT >= NATAL_VIGENCIA.inicio && hojeBRT <= NATAL_VIGENCIA.fim;
}
