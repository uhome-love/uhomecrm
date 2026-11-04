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
}

export const PRODUTOS_NATAL: ProdutoNatal[] = [
  { slug: "open-bosque", nome: "Open Bosque", incorporadora: "Open Construtora", local: "Passo d'Areia, Porto Alegre", situacao: "Em obras", faixa: "ate_300",
    tipologias: [{ nome: "1 dormitório", valor: 240000 }, { nome: "2 dorm. sem vaga", valor: 269000 }, { nome: "2 dorm. com vaga", valor: 292000 }],
    condicao: "3 dormitórios esgotado.", liaSlug: "open-bosque", pendencia: "Ficha da Lia desligada desde julho — aguardando sua decisão." },
  { slug: "essence-canoas", nome: "Essence Canoas", incorporadora: "Ábaco Urbanizadora", local: "São José, Canoas", situacao: "Em obras", faixa: "ate_300",
    tipologias: [{ nome: "Lotes", valor: 289000 }], condicao: "Faixa de R$ 289 a 500 mil conforme o lote.", liaSlug: null,
    pendencia: "Pouco material (3 fotos, sem book/tabela)." },
  { slug: "open-arvoredo", nome: "Open Arvoredo", incorporadora: "Open Construtora", local: "Passo d'Areia, Porto Alegre", situacao: "Lançamento", faixa: "300_400",
    tipologias: [{ nome: "2 dorm. com suíte", valor: 329000 }, { nome: "3 dorm. com suíte", valor: 392000 }], liaSlug: null,
    pendencia: "Renda mínima diverge (R$ 9.000 x R$ 6.900)." },
  { slug: "skyglass-parque-moinhos", nome: "Skyglass", incorporadora: "Cyrela Goldsztein", local: "Rio Branco, Porto Alegre", situacao: "Pronto para morar", faixa: "300_400",
    tipologias: [{ nome: "Studio e 1 dorm.", valor: 369000 }], condicao: "ITBI e registro grátis + 1 ano de condomínio.", liaSlug: null,
    naoCitar: ["Fechadura digital"] },
  { slug: "casa-tua-porto-alegre", nome: "Casa Tua Porto Alegre", incorporadora: "Encorp", local: "Alto Petrópolis, Porto Alegre", situacao: "Em obras", faixa: "casas",
    tipologias: [{ nome: "Casa 2 dorm.", valor: 520000 }, { nome: "Casa 3 dorm.", valor: 659000 }, { nome: "Casa 3 dorm. c/ terraço", valor: 750000 }],
    condicao: "Desconto no crédito associativo.", liaSlug: "casa-tua-porto-alegre", naoCitar: ["Piscina com raia"] },
  { slug: "casa-tua-canoas", nome: "Casa Tua Canoas", incorporadora: "Encorp", local: "Marechal Rondon, Canoas", situacao: "Lançamento", faixa: "casas",
    tipologias: [{ nome: "Sobrado 3 dorm.", valor: 735000 }, { nome: "Sobrado 4 dorm.", valor: 879000 }],
    condicao: "Desconto no crédito associativo.", liaSlug: "casa-tua-canoas" },
  { slug: "boa-vista-country-club", nome: "Boa Vista Country Club", incorporadora: "Cyrela Goldsztein", local: "Boa Vista, Porto Alegre", situacao: "Pronto para morar", faixa: "alto_padrao",
    tipologias: [{ nome: "2 dorm. c/ varanda", valor: 849000 }, { nome: "3 dorm. c/ varanda", valor: 978000 }], liaSlug: null,
    pendencia: "Inativo no CRM — aguardando sua decisão." },
  { slug: "golden-lake", nome: "Golden Lake", incorporadora: "Multiplan", local: "Cristal, Porto Alegre", situacao: "Pronto / em obras / lançamento", faixa: "alto_padrao",
    tipologias: [{ nome: "Lake Eyre · 127 m²", valor: 2480000 }, { nome: "Lake Baikal · 197 m²", valor: 3800000 }, { nome: "Lake Victoria · 299 m²", valor: 5900000 }],
    liaSlug: "lake-baikal", pendencia: "Lake Eyre inativo e Lake Victoria sem cadastro; só 1 foto.", naoCitar: ["Wellness com mais de 3.500 m²"] },
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
