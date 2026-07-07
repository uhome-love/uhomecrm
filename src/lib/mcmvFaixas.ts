/**
 * Configuração AUDITADA do Minha Casa Minha Vida (MCMV) 2026.
 *
 * Base legal: Portaria MCID nº 333, de 30/03/2026 (DOU 01/04/2026). Novas regras
 * operadas pela Caixa Econômica Federal desde 22/04/2026. Confirmado em fontes
 * cruzadas (gov.br / Ministério das Cidades, Finaqui, Regente Imóveis).
 *
 * Regras gerais do programa:
 *  - Indexador: Taxa Referencial (TR).
 *  - Comprometimento máximo de renda: 30% da renda bruta familiar.
 *  - Prazo máximo: até 420 meses (35 anos).
 *  - FGTS pode ser usado como entrada/amortização (mín. 3 anos de contribuição).
 *
 * ⚠️ Ao atualizar, altere DATA_REFERENCIA_MCMV e revise as faixas.
 */

export const DATA_REFERENCIA_MCMV = "Jul/2026";
export const FONTE_MCMV = "Portaria MCID 333/2026 (gov.br) + Finaqui + Regente (jul/2026)";
export const MCMV_PRAZO_MAX_MESES = 420;
export const MCMV_COMPROMETIMENTO_MAX = 0.3;
export const MCMV_RENDA_MAX = 13000; // teto absoluto do programa (Faixa 4)

export interface FaixaMCMV {
  id: number;
  nome: string;
  rendaMin: number;
  rendaMax: number;
  /** Taxa anual de referência (nominal). */
  taxaAnual: number;
  /** Teto de valor do imóvel para a faixa. */
  tetoImovel: number;
  /** Entrada mínima (fração). undefined quando há subsídio/regra especial. */
  entradaMinima?: number;
  /** Subsídio máximo estimado (R$), quando aplicável. */
  subsidioMax?: number;
  /** true quando o corretor consegue simular parcela (cliente escolhe imóvel). */
  simulavel: boolean;
  observacao: string;
}

export const FAIXAS_MCMV: FaixaMCMV[] = [
  {
    id: 1,
    nome: "Faixa 1",
    rendaMin: 0,
    rendaMax: 3200,
    taxaAnual: 0.0425, // 4,00% N/NE · 4,25% demais regiões (usado o maior por padrão)
    tetoImovel: 270000,
    subsidioMax: 55000,
    simulavel: false,
    observacao:
      "Seleção via prefeitura ou app HabitaCaixa — o beneficiário não escolhe o imóvel. Subsídio pode chegar a 95% do valor. Não é possível simular parcela aqui.",
  },
  {
    id: 2,
    nome: "Faixa 2",
    rendaMin: 3200.01,
    rendaMax: 5000,
    taxaAnual: 0.065, // ~5,5% a 6,5% a.a.
    tetoImovel: 350000,
    subsidioMax: 55000,
    simulavel: true,
    observacao:
      "Subsídio de até ~R$ 55.000 (decrescente conforme a renda) — valor exato depende da análise da Caixa por renda/região. Imóvel usado só em municípios com até 50 mil habitantes.",
  },
  {
    id: 3,
    nome: "Faixa 3",
    rendaMin: 5000.01,
    rendaMax: 9600,
    taxaAnual: 0.0766, // até 7,66% a.a.
    tetoImovel: 400000,
    simulavel: true,
    observacao:
      "Sem subsídio direto — financiamento com taxa beneficiada. Aceita novo, usado (municípios ≤ 50 mil hab.) ou na planta.",
  },
  {
    id: 4,
    nome: "Faixa 4 (Classe Média)",
    rendaMin: 9600.01,
    rendaMax: 13000,
    taxaAnual: 0.1, // 10% a.a. nominal
    tetoImovel: 600000,
    entradaMinima: 0.2,
    simulavel: true,
    observacao:
      "Entrada mínima de 20%, sem subsídio. Acesso ao SFH com taxa controlada (10% a.a.). Aceita novo, usado (qualquer município) ou na planta financiada pela Caixa.",
  },
];

export interface EnquadramentoMCMV {
  faixa: FaixaMCMV | null;
  elegivel: boolean;
  alertas: string[];
  /** Estimativa de subsídio a abater do valor financiado (Faixa 1 e 2). */
  subsidioEstimado: number;
}

/**
 * Enquadra o cliente numa faixa MCMV a partir da renda familiar e valor do imóvel.
 * Retorna alertas quando não se enquadra (renda acima do teto, imóvel acima do teto da faixa, etc.).
 */
export function enquadrarMCMV(rendaFamiliar: number, valorImovel: number): EnquadramentoMCMV {
  const alertas: string[] = [];

  if (!rendaFamiliar || rendaFamiliar <= 0) {
    return { faixa: null, elegivel: false, alertas: ["Informe a renda familiar para enquadrar no MCMV."], subsidioEstimado: 0 };
  }

  if (rendaFamiliar > MCMV_RENDA_MAX) {
    return {
      faixa: null,
      elegivel: false,
      alertas: [
        `Renda familiar acima de R$ ${MCMV_RENDA_MAX.toLocaleString("pt-BR")} — não se enquadra no Minha Casa Minha Vida. Use o financiamento convencional.`,
      ],
      subsidioEstimado: 0,
    };
  }

  const faixa = FAIXAS_MCMV.find((f) => rendaFamiliar >= f.rendaMin && rendaFamiliar <= f.rendaMax) ?? null;

  if (!faixa) {
    return { faixa: null, elegivel: false, alertas: ["Não foi possível enquadrar a renda informada."], subsidioEstimado: 0 };
  }

  let elegivel = faixa.simulavel;

  if (!faixa.simulavel) {
    alertas.push(faixa.observacao);
  }

  if (valorImovel > 0 && valorImovel > faixa.tetoImovel) {
    elegivel = false;
    alertas.push(
      `Imóvel de R$ ${valorImovel.toLocaleString("pt-BR")} acima do teto da ${faixa.nome} (R$ ${faixa.tetoImovel.toLocaleString("pt-BR")}).`,
    );
  }

  // Subsídio estimado (grosseiro, apenas indicativo) para Faixa 1 e 2.
  let subsidioEstimado = 0;
  if (faixa.subsidioMax && valorImovel > 0) {
    if (faixa.id === 1) {
      subsidioEstimado = Math.min(faixa.subsidioMax, valorImovel * 0.9);
    } else if (faixa.id === 2) {
      // Decresce conforme a renda dentro da faixa (mais renda → menos subsídio).
      const range = faixa.rendaMax - faixa.rendaMin;
      const posicao = range > 0 ? (rendaFamiliar - faixa.rendaMin) / range : 0;
      subsidioEstimado = Math.round(faixa.subsidioMax * (1 - posicao) * 0.6);
    }
  }

  return { faixa, elegivel, alertas, subsidioEstimado };
}
