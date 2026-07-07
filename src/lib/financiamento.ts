/**
 * Núcleo de cálculo de financiamento imobiliário (funções puras e testáveis).
 *
 * Sistemas suportados:
 *  - PRICE: parcela fixa. PMT = PV·i / (1 − (1+i)^−n)
 *  - SAC:   amortização constante. amortização = PV/n; juros = saldo·i; parcela decrescente.
 *
 * Convenção de taxa: a taxa de entrada é ANUAL (a.a., nominal). A taxa mensal segue
 * a prática dos simuladores bancários brasileiros (SFH/SBPE): i_m = i_a / 12.
 *
 * IMPORTANTE: valores estimativos. Não incluem TR, seguros (MIP/DFI) nem CET.
 */

export type SistemaAmortizacao = "SAC" | "PRICE";

export interface ParcelaDetalhe {
  numero: number;
  prestacao: number;
  juros: number;
  amortizacao: number;
  saldoDevedor: number;
}

export interface ResultadoSimulacao {
  valorFinanciado: number;
  taxaAnual: number;
  taxaMensal: number;
  prazoMeses: number;
  sistema: SistemaAmortizacao;
  primeiraParcela: number;
  ultimaParcela: number;
  totalPago: number;
  totalJuros: number;
  parcelas: ParcelaDetalhe[];
}

/**
 * Converte taxa anual nominal (ex.: 0.1119 = 11,19% a.a.) em taxa mensal.
 * Convenção dos simuladores bancários brasileiros: i_m = i_a / 12.
 */
export function taxaAnualParaMensal(taxaAnual: number): number {
  return taxaAnual / 12;
}

/** Tabela PRICE — parcela fixa. */
export function calcularPrice(
  valorFinanciado: number,
  taxaAnual: number,
  prazoMeses: number,
): ResultadoSimulacao {
  const i = taxaAnualParaMensal(taxaAnual);
  const parcelas: ParcelaDetalhe[] = [];

  // Parcela fixa (PMT). Se juros ~0, divide linearmente.
  const pmt =
    i > 1e-9
      ? (valorFinanciado * i) / (1 - Math.pow(1 + i, -prazoMeses))
      : valorFinanciado / prazoMeses;

  let saldo = valorFinanciado;
  let totalPago = 0;
  let totalJuros = 0;

  for (let n = 1; n <= prazoMeses; n++) {
    const juros = saldo * i;
    let amortizacao = pmt - juros;
    // Ajuste final para zerar o saldo (arredondamentos)
    if (n === prazoMeses) {
      amortizacao = saldo;
    }
    saldo = Math.max(0, saldo - amortizacao);
    const prestacao = amortizacao + juros;
    totalPago += prestacao;
    totalJuros += juros;
    parcelas.push({ numero: n, prestacao, juros, amortizacao, saldoDevedor: saldo });
  }

  return {
    valorFinanciado,
    taxaAnual,
    taxaMensal: i,
    prazoMeses,
    sistema: "PRICE",
    primeiraParcela: parcelas[0]?.prestacao ?? 0,
    ultimaParcela: parcelas[parcelas.length - 1]?.prestacao ?? 0,
    totalPago,
    totalJuros,
    parcelas,
  };
}

/** Tabela SAC — amortização constante, parcela decrescente. */
export function calcularSac(
  valorFinanciado: number,
  taxaAnual: number,
  prazoMeses: number,
): ResultadoSimulacao {
  const i = taxaAnualParaMensal(taxaAnual);
  const amortizacao = valorFinanciado / prazoMeses;
  const parcelas: ParcelaDetalhe[] = [];

  let saldo = valorFinanciado;
  let totalPago = 0;
  let totalJuros = 0;

  for (let n = 1; n <= prazoMeses; n++) {
    const juros = saldo * i;
    let amort = amortizacao;
    if (n === prazoMeses) amort = saldo; // zera o saldo
    saldo = Math.max(0, saldo - amort);
    const prestacao = amort + juros;
    totalPago += prestacao;
    totalJuros += juros;
    parcelas.push({ numero: n, prestacao, juros, amortizacao: amort, saldoDevedor: saldo });
  }

  return {
    valorFinanciado,
    taxaAnual,
    taxaMensal: i,
    prazoMeses,
    sistema: "SAC",
    primeiraParcela: parcelas[0]?.prestacao ?? 0,
    ultimaParcela: parcelas[parcelas.length - 1]?.prestacao ?? 0,
    totalPago,
    totalJuros,
    parcelas,
  };
}

export function simular(
  valorFinanciado: number,
  taxaAnual: number,
  prazoMeses: number,
  sistema: SistemaAmortizacao,
): ResultadoSimulacao {
  return sistema === "SAC"
    ? calcularSac(valorFinanciado, taxaAnual, prazoMeses)
    : calcularPrice(valorFinanciado, taxaAnual, prazoMeses);
}

// ─── Limites de idade (regra bancária brasileira) ───────────────────────────

/** Idade final máxima do contrato: 80 anos e 6 meses (padrão Caixa/mercado). */
export const IDADE_FINAL_MAX_MESES = 80 * 12 + 6; // 966 meses
export const IDADE_MINIMA_ANOS = 18;

/** Calcula idade em meses a partir da data de nascimento (YYYY-MM-DD). */
export function idadeEmMeses(dataNascimento: string, hoje = new Date()): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(`${dataNascimento}T12:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  let meses = (hoje.getFullYear() - nasc.getFullYear()) * 12 + (hoje.getMonth() - nasc.getMonth());
  if (hoje.getDate() < nasc.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/**
 * Prazo máximo permitido pela idade, em meses.
 * = (80 anos e 6 meses) − idade atual. Nunca negativo.
 */
export function prazoMaximoPorIdade(dataNascimento: string, hoje = new Date()): number | null {
  const meses = idadeEmMeses(dataNascimento, hoje);
  if (meses === null) return null;
  return Math.max(0, IDADE_FINAL_MAX_MESES - meses);
}

export interface AnaliseIdade {
  idadeAnos: number;
  elegivel: boolean;
  motivo?: string;
  prazoMaxMeses: number;
}

export function analisarIdade(dataNascimento: string, hoje = new Date()): AnaliseIdade | null {
  const meses = idadeEmMeses(dataNascimento, hoje);
  if (meses === null) return null;
  const idadeAnos = Math.floor(meses / 12);
  const prazoMaxMeses = Math.max(0, IDADE_FINAL_MAX_MESES - meses);
  if (idadeAnos < IDADE_MINIMA_ANOS) {
    return {
      idadeAnos,
      elegivel: false,
      motivo: `Idade mínima para financiar é ${IDADE_MINIMA_ANOS} anos.`,
      prazoMaxMeses,
    };
  }
  if (prazoMaxMeses < 12) {
    return {
      idadeAnos,
      elegivel: false,
      motivo: "Idade próxima ao limite de 80 anos e 6 meses ao fim do contrato — prazo insuficiente.",
      prazoMaxMeses,
    };
  }
  return { idadeAnos, elegivel: true, prazoMaxMeses };
}

// ─── Análise de comprometimento de renda ────────────────────────────────────

export const COMPROMETIMENTO_MAX = 0.3; // 30% da renda bruta

export interface AnaliseRenda {
  percentualComprometido: number;
  parcelaMaxima: number;
  aprovavel: boolean;
}

export function analisarRenda(primeiraParcela: number, renda: number): AnaliseRenda | null {
  if (!renda || renda <= 0) return null;
  const parcelaMaxima = renda * COMPROMETIMENTO_MAX;
  return {
    percentualComprometido: primeiraParcela / renda,
    parcelaMaxima,
    aprovavel: primeiraParcela <= parcelaMaxima,
  };
}
