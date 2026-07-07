import { describe, it, expect } from "vitest";
import { simular } from "./financiamento";
import {
  calcularSeguros,
  taxaMIPPorIdade,
  getSeguradora,
  TAXA_DFI_MENSAL,
  TARIFA_ADMIN_MENSAL,
} from "./segurosFinanciamento";

describe("segurosFinanciamento", () => {
  it("MIP cresce com a idade", () => {
    expect(taxaMIPPorIdade(25)).toBeLessThan(taxaMIPPorIdade(50));
    expect(taxaMIPPorIdade(50)).toBeLessThan(taxaMIPPorIdade(65));
    // Um proponente de 60 paga várias vezes o de 25.
    expect(taxaMIPPorIdade(60) / taxaMIPPorIdade(25)).toBeGreaterThan(4);
  });

  it("mapeia seguradora por banco", () => {
    expect(getSeguradora("caixa")).toMatch(/Caixa/);
    expect(getSeguradora("santander")).toMatch(/Zurich/);
    expect(getSeguradora("desconhecido")).toMatch(/parceira/);
  });

  it("DFI é estável (não depende da idade) e sobre o valor do imóvel", () => {
    const r = simular(300000, 0.1119, 360, "SAC");
    const jovem = calcularSeguros(r, { valorImovel: 400000, bancoId: "caixa", idadeInicialMeses: 25 * 12 });
    const velho = calcularSeguros(r, { valorImovel: 400000, bancoId: "caixa", idadeInicialMeses: 55 * 12 });
    // DFI igual independente da idade
    expect(jovem.parcelas[0].dfi).toBeCloseTo(400000 * TAXA_DFI_MENSAL, 6);
    expect(jovem.parcelas[0].dfi).toBeCloseTo(velho.parcelas[0].dfi, 6);
    // MIP maior para o mais velho
    expect(velho.parcelas[0].mip).toBeGreaterThan(jovem.parcelas[0].mip);
  });

  it("parcela com seguro > prestação pura e inclui tarifa", () => {
    const r = simular(300000, 0.1119, 360, "SAC");
    const s = calcularSeguros(r, { valorImovel: 375000, bancoId: "caixa", idadeInicialMeses: 30 * 12 });
    const p0 = s.parcelas[0];
    expect(p0.prestacaoTotal).toBeGreaterThan(p0.prestacao);
    expect(p0.tarifa).toBe(TARIFA_ADMIN_MENSAL);
    expect(p0.prestacaoTotal).toBeCloseTo(p0.prestacao + p0.mip + p0.dfi + p0.tarifa, 6);
  });

  it("ordem de grandeza dos seguros compatível com referência de mercado", () => {
    // Ref.: saldo ~R$300k, imóvel ~R$400k, 30 anos → MIP ~R$63/mês, DFI ~R$13,6/mês.
    const r = simular(300000, 0.1119, 360, "SAC");
    const s = calcularSeguros(r, { valorImovel: 400000, bancoId: "caixa", idadeInicialMeses: 30 * 12 });
    const p0 = s.parcelas[0];
    expect(p0.mip).toBeGreaterThan(45);
    expect(p0.mip).toBeLessThan(90);
    expect(p0.dfi).toBeGreaterThan(8);
    expect(p0.dfi).toBeLessThan(20);
  });

  it("CET aproximado é maior que a taxa nominal (por causa dos seguros/tarifa)", () => {
    const r = simular(300000, 0.1119, 360, "SAC");
    const s = calcularSeguros(r, { valorImovel: 375000, bancoId: "caixa", idadeInicialMeses: 35 * 12 });
    expect(s.cetAnual).toBeGreaterThan(0.1119);
    // Sanidade: CET num range plausível (não explode).
    expect(s.cetAnual).toBeLessThan(0.20);
  });

  it("usa idade padrão quando não há data de nascimento", () => {
    const r = simular(300000, 0.1119, 360, "SAC");
    const s = calcularSeguros(r, { valorImovel: 375000, bancoId: "caixa", idadeInicialMeses: null });
    expect(s.idadeEstimada).toBe(true);
    expect(s.idadeConsiderada).toBe(35);
  });
});
