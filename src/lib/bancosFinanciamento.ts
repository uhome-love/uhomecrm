/**
 * Configuração AUDITADA das taxas de financiamento convencional (SBPE/SFH).
 *
 * Referência: Julho/2026. Fontes cruzadas (Monitor de Taxas LARYA — correspondente
 * bancário credenciado — e comparativo SFH Finaqui). Contexto: Selic 14,25%,
 * teto SFH ampliado para R$ 2,25 mi.
 *
 * As taxas são "de balcão" (a partir de) para bons perfis, SEM TR/seguros/CET, e
 * SUJEITAS À ANÁLISE DE CRÉDITO. O campo de taxa na tela é editável para o corretor
 * ajustar à proposta concreta do banco.
 *
 * ⚠️ Ao atualizar, altere também DATA_REFERENCIA_TAXAS e revise cada `taxaAnual`.
 */

import type { SistemaAmortizacao } from "./financiamento";

export const DATA_REFERENCIA_TAXAS = "Jul/2026";
export const FONTE_TAXAS = "Monitor LARYA + comparativo SFH Finaqui (jul/2026)";

export interface BancoConfig {
  id: string;
  nome: string;
  /** Taxa anual de referência (ex.: 0.1119 = 11,19% a.a. + TR). */
  taxaAnual: number;
  sistemas: SistemaAmortizacao[];
  prazoMaxMeses: number;
  /** Percentual máximo do valor do imóvel que pode ser financiado (0.8 = 80%). */
  financiaAte: number;
  /** true quando o banco oferece Minha Casa Minha Vida (Caixa). */
  temMCMV?: boolean;
  observacao?: string;
}

export const BANCOS: BancoConfig[] = [
  {
    id: "caixa",
    nome: "Caixa Econômica Federal",
    taxaAnual: 0.1119,
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 420,
    financiaAte: 0.8,
    temMCMV: true,
    observacao: "Menor taxa de balcão do mercado (SBPE). Também opera o Minha Casa Minha Vida.",
  },
  {
    id: "itau",
    nome: "Itaú Unibanco",
    taxaAnual: 0.116,
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 360,
    financiaAte: 0.82,
    observacao: "Processo ágil e digital. Aprovação rápida.",
  },
  {
    id: "santander",
    nome: "Santander",
    taxaAnual: 0.117,
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 420,
    financiaAte: 0.8,
    observacao: "Flexível em composição de renda e análise para autônomos.",
  },
  {
    id: "bradesco",
    nome: "Bradesco",
    taxaAnual: 0.117,
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 360,
    financiaAte: 0.8,
    observacao: "Permite 'pula parcela' e financiamento de parte dos custos de cartório.",
  },
  {
    id: "bb",
    nome: "Banco do Brasil",
    taxaAnual: 0.12,
    sistemas: ["SAC", "PRICE"],
    prazoMaxMeses: 420,
    financiaAte: 0.8,
    observacao: "Melhores condições para correntistas com relacionamento premium.",
  },
];

export function getBanco(id: string): BancoConfig | undefined {
  return BANCOS.find((b) => b.id === id);
}
