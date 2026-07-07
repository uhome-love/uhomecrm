/**
 * Configuração AUDITADA das taxas de financiamento convencional (SBPE/SFH).
 *
 * Região de referência: PORTO ALEGRE E REGIÃO METROPOLITANA (RS / Região Sul).
 * Para o MCMV, a Região Sul segue as taxas de "demais regiões" (não Norte/Nordeste).
 *
 * Referência: Julho/2026. Fontes cruzadas (Monitor de Taxas LARYA — correspondente
 * bancário credenciado — e comparativo SFH Finaqui). Contexto: Selic 14,25%,
 * teto SFH ampliado para R$ 2,25 mi.
 *
 * Distinção NOVO x USADO: vários bancos aplicam cota de financiamento (LTV) e/ou
 * taxa distintas para imóvel usado (maior risco de avaliação de engenharia). Os
 * valores por tipo estão em `regras.novo` e `regras.usado`.
 *
 * As taxas são "de balcão" (a partir de) para bons perfis, SEM TR/seguros/CET, e
 * SUJEITAS À ANÁLISE DE CRÉDITO. O campo de taxa na tela é editável para o corretor
 * ajustar à proposta concreta do banco.
 *
 * ⚠️ Ao atualizar, altere também DATA_REFERENCIA_TAXAS e revise cada regra.
 */

import type { SistemaAmortizacao } from "./financiamento";

export const DATA_REFERENCIA_TAXAS = "Jul/2026";
export const FONTE_TAXAS = "Monitor LARYA + comparativo SFH Finaqui (jul/2026)";

/** Região sobre a qual as condições foram auditadas. */
export const REGIAO_REFERENCIA = "Porto Alegre e Região Metropolitana (RS)";
/** Grupo de região usado pelo MCMV — RS pertence a "demais regiões". */
export const GRUPO_REGIAO_MCMV: "norte_nordeste" | "demais" = "demais";

export type TipoImovel = "novo" | "usado";

export interface CondicaoImovel {
  /** Taxa anual de referência (ex.: 0.1119 = 11,19% a.a. + TR). */
  taxaAnual: number;
  /** Percentual máximo do valor do imóvel financiável (0.8 = 80%). */
  financiaAte: number;
}

export interface BancoConfig {
  id: string;
  nome: string;
  /** Regras auditadas por tipo de imóvel (Porto Alegre e RM). */
  regras: Record<TipoImovel, CondicaoImovel>;
  sistemas: SistemaAmortizacao[];
  prazoMaxMeses: number;
  /** true quando o banco oferece Minha Casa Minha Vida (Caixa). */
  temMCMV?: boolean;
  observacao?: string;
  /** Observação específica de imóvel usado, quando houver. */
  observacaoUsado?: string;
}

export const BANCOS: BancoConfig[] = [
  {
    id: "caixa",
    nome: "Caixa Econômica Federal",
    regras: {
      novo: { taxaAnual: 0.1119, financiaAte: 0.8 },
      usado: { taxaAnual: 0.1119, financiaAte: 0.8 },
    },
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 420,
    temMCMV: true,
    observacao: "Menor taxa de balcão do mercado (SBPE). Também opera o Minha Casa Minha Vida.",
    observacaoUsado:
      "Cota de 80% no SAC e 70% na Tabela Price. Exige vistoria de engenharia — se a avaliação vier abaixo do preço negociado, a entrada aumenta.",
  },
  {
    id: "itau",
    nome: "Itaú Unibanco",
    regras: {
      novo: { taxaAnual: 0.116, financiaAte: 0.9 },
      usado: { taxaAnual: 0.1179, financiaAte: 0.8 },
    },
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 360,
    observacao: "Processo ágil e digital. Aprovação rápida.",
    observacaoUsado:
      "Imóvel usado: cota reduzida para 80% e taxa levemente maior que no imóvel novo.",
  },
  {
    id: "santander",
    nome: "Santander",
    regras: {
      novo: { taxaAnual: 0.117, financiaAte: 0.8 },
      usado: { taxaAnual: 0.118, financiaAte: 0.8 },
    },
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 420,
    observacao: "Flexível em composição de renda e análise para autônomos.",
    observacaoUsado: "Imóvel usado costuma ter acréscimo de taxa (~0,10 p.p.).",
  },
  {
    id: "bradesco",
    nome: "Bradesco",
    regras: {
      novo: { taxaAnual: 0.117, financiaAte: 0.8 },
      usado: { taxaAnual: 0.118, financiaAte: 0.8 },
    },
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 360,
    observacao: "Permite 'pula parcela' e financiamento de parte dos custos de cartório.",
    observacaoUsado: "Imóvel usado costuma ter acréscimo de taxa (~0,10 p.p.).",
  },
  {
    id: "bb",
    nome: "Banco do Brasil",
    regras: {
      novo: { taxaAnual: 0.12, financiaAte: 0.8 },
      usado: { taxaAnual: 0.12, financiaAte: 0.8 },
    },
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 420,
    observacao: "Melhores condições para correntistas com relacionamento premium.",
    observacaoUsado: "Mesma taxa para novo e usado; cota de 80%.",
  },
];

export function getBanco(id: string): BancoConfig | undefined {
  return BANCOS.find((b) => b.id === id);
}

/** Retorna a condição (taxa + LTV) auditada do banco para o tipo de imóvel. */
export function getCondicao(banco: BancoConfig, tipo: TipoImovel): CondicaoImovel {
  return banco.regras[tipo];
}
