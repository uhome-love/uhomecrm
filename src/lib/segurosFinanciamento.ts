/**
 * Estimativa de seguros habitacionais (MIP + DFI), tarifa de administração e
 * CET aproximado — para deixar a parcela simulada o mais próximo possível da
 * carta real do banco.
 *
 * ⚠️ IMPORTANTE — natureza estimativa:
 * As seguradoras não publicam suas tabelas atuariais de MIP. Os valores abaixo
 * são CALIBRADOS a partir de referências públicas de mercado (2025/2026):
 *  - MIP: incide sobre o SALDO DEVEDOR e cresce com a idade do proponente
 *    (~0,017%/mês aos 25 anos → ~0,20%/mês acima de 65). Um proponente de 60
 *    paga de 4 a 6× o de 25 com o mesmo saldo.
 *  - DFI: incide sobre o VALOR DO IMÓVEL (avaliação), taxa estável (~0,0035%/mês),
 *    não varia com a idade.
 *  - Tarifa de administração/serviços: valor fixo mensal (padrão de mercado R$ 25).
 * Fontes cruzadas: Caixa Seguradora (condições gerais), Finaqui, ParcelaImóvel,
 * Resolução CMN 4.676/2018 e CNSP 447/2022 (obrigatoriedade e portabilidade).
 *
 * O CET aproximado é a taxa interna de retorno (TIR) mensal do fluxo real
 * (liberação do crédito × parcelas com juros + amortização + seguros + tarifa),
 * anualizada. Não inclui IOF, tarifa de avaliação inicial nem TR projetada, por
 * isso é "aproximado" e sempre um pouco menor que o CET oficial.
 */

import type { ResultadoSimulacao, ParcelaDetalhe } from "./financiamento";

export const DATA_REFERENCIA_SEGUROS = "Jul/2026";

/** Faixa de MIP: taxa mensal (fração) sobre o saldo devedor, por idade máxima da faixa. */
interface FaixaMIP {
  ateAnos: number;
  taxaMensal: number;
}

/** Tabela de MIP calibrada por faixa etária (referência de mercado 2025/2026). */
export const TABELA_MIP: FaixaMIP[] = [
  { ateAnos: 25, taxaMensal: 0.00017 },
  { ateAnos: 30, taxaMensal: 0.00021 },
  { ateAnos: 35, taxaMensal: 0.00025 },
  { ateAnos: 40, taxaMensal: 0.0003 },
  { ateAnos: 45, taxaMensal: 0.00038 },
  { ateAnos: 50, taxaMensal: 0.0006 },
  { ateAnos: 55, taxaMensal: 0.00085 },
  { ateAnos: 60, taxaMensal: 0.0011 },
  { ateAnos: 65, taxaMensal: 0.0015 },
  { ateAnos: 200, taxaMensal: 0.002 },
];

/** DFI: taxa mensal (fração) sobre o valor do imóvel. Estável, não varia com idade. */
export const TAXA_DFI_MENSAL = 0.000035; // ~0,0035% a.m.

/** Tarifa de administração/serviços mensal (padrão de mercado). */
export const TARIFA_ADMIN_MENSAL = 25;

/** Idade padrão usada quando o proponente não informou a data de nascimento. */
export const IDADE_PADRAO_ESTIMATIVA_ANOS = 35;

/** Seguradora vinculada a cada banco (parceira padrão das operações habitacionais). */
export const SEGURADORA_POR_BANCO: Record<string, string> = {
  caixa: "Caixa Seguradora",
  itau: "Itaú Seguros",
  santander: "Zurich Santander",
  bradesco: "Bradesco Seguros",
  bb: "BB Seguros (Brasilseg)",
};

export function getSeguradora(bancoId: string): string {
  return SEGURADORA_POR_BANCO[bancoId] ?? "Seguradora parceira do banco";
}

/** Retorna a taxa mensal de MIP para a idade (anos) informada. */
export function taxaMIPPorIdade(idadeAnos: number): number {
  const faixa = TABELA_MIP.find((f) => idadeAnos <= f.ateAnos) ?? TABELA_MIP[TABELA_MIP.length - 1];
  return faixa.taxaMensal;
}

export interface ParcelaComSeguro extends ParcelaDetalhe {
  /** Seguro MIP do mês (sobre o saldo devedor no início do mês). */
  mip: number;
  /** Seguro DFI do mês (sobre o valor do imóvel). */
  dfi: number;
  /** Tarifa de administração do mês. */
  tarifa: number;
  /** Prestação + MIP + DFI + tarifa. */
  prestacaoTotal: number;
}

export interface ResultadoComSeguros {
  parcelas: ParcelaComSeguro[];
  seguradora: string;
  idadeConsiderada: number;
  idadeEstimada: boolean; // true quando não havia data de nascimento
  primeiraParcelaTotal: number;
  ultimaParcelaTotal: number;
  totalMIP: number;
  totalDFI: number;
  totalTarifas: number;
  totalSeguros: number; // MIP + DFI + tarifas
  totalPagoComSeguros: number;
  /** CET anual aproximado (fração, ex.: 0.1234 = 12,34% a.a.). */
  cetAnual: number;
  /** CET mensal aproximado (fração). */
  cetMensal: number;
}

export interface OpcoesSeguro {
  valorImovel: number;
  bancoId: string;
  /** Idade do proponente em meses no início do contrato (null → usa padrão). */
  idadeInicialMeses: number | null;
}

/**
 * TIR mensal do fluxo de caixa via bisseção.
 * fluxos[0] deve ser positivo (entrada de crédito) e os demais negativos.
 */
function tirMensal(fluxos: number[]): number {
  const npv = (taxa: number) =>
    fluxos.reduce((acc, cf, t) => acc + cf / Math.pow(1 + taxa, t), 0);

  let baixo = 1e-9;
  let alto = 1.0; // 100% ao mês como teto de busca
  let fBaixo = npv(baixo);
  let fAlto = npv(alto);

  // Se não houver troca de sinal, retorna 0 (sem custo detectável).
  if (fBaixo * fAlto > 0) return 0;

  for (let i = 0; i < 200; i++) {
    const meio = (baixo + alto) / 2;
    const fMeio = npv(meio);
    if (Math.abs(fMeio) < 1e-6) return meio;
    if (fBaixo * fMeio < 0) {
      alto = meio;
      fAlto = fMeio;
    } else {
      baixo = meio;
      fBaixo = fMeio;
    }
  }
  return (baixo + alto) / 2;
}

/**
 * Enriquece um resultado de simulação com seguros (MIP/DFI), tarifa e CET aproximado.
 */
export function calcularSeguros(
  resultado: ResultadoSimulacao,
  opts: OpcoesSeguro,
): ResultadoComSeguros {
  const idadeEstimada = opts.idadeInicialMeses == null;
  const idadeInicialMeses = opts.idadeInicialMeses ?? IDADE_PADRAO_ESTIMATIVA_ANOS * 12;

  const dfiMensal = opts.valorImovel * TAXA_DFI_MENSAL;

  let totalMIP = 0;
  let totalDFI = 0;
  let totalTarifas = 0;

  const parcelas: ParcelaComSeguro[] = resultado.parcelas.map((p, idx) => {
    // Saldo no início do mês = saldo devedor da parcela anterior (ou o financiado no 1º mês).
    const saldoInicio = idx === 0 ? resultado.valorFinanciado : resultado.parcelas[idx - 1].saldoDevedor;
    // Idade avança ao longo do contrato (MIP recalculado por faixa).
    const idadeAnos = Math.floor((idadeInicialMeses + idx) / 12);
    const mip = saldoInicio * taxaMIPPorIdade(idadeAnos);
    const dfi = dfiMensal;
    const tarifa = TARIFA_ADMIN_MENSAL;

    totalMIP += mip;
    totalDFI += dfi;
    totalTarifas += tarifa;

    return {
      ...p,
      mip,
      dfi,
      tarifa,
      prestacaoTotal: p.prestacao + mip + dfi + tarifa,
    };
  });

  // Fluxo de caixa para o CET: +crédito no mês 0, -parcela total nos demais.
  const fluxos: number[] = [resultado.valorFinanciado];
  for (const p of parcelas) fluxos.push(-p.prestacaoTotal);
  const cetMensal = tirMensal(fluxos);
  const cetAnual = Math.pow(1 + cetMensal, 12) - 1;

  const totalSeguros = totalMIP + totalDFI + totalTarifas;

  return {
    parcelas,
    seguradora: getSeguradora(opts.bancoId),
    idadeConsiderada: Math.floor(idadeInicialMeses / 12),
    idadeEstimada,
    primeiraParcelaTotal: parcelas[0]?.prestacaoTotal ?? 0,
    ultimaParcelaTotal: parcelas[parcelas.length - 1]?.prestacaoTotal ?? 0,
    totalMIP,
    totalDFI,
    totalTarifas,
    totalSeguros,
    totalPagoComSeguros: resultado.totalPago + totalSeguros,
    cetAnual,
    cetMensal,
  };
}
