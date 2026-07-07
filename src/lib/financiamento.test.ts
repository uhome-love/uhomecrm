import { describe, it, expect } from "vitest";
import {
  calcularPrice,
  calcularSac,
  taxaAnualParaMensal,
  simular,
  analisarRenda,
  analisarIdade,
  prazoMaximoPorIdade,
  idadeEmMeses,
  IDADE_FINAL_MAX_MESES,
} from "./financiamento";
import { enquadrarMCMV } from "./mcmvFaixas";

describe("taxaAnualParaMensal", () => {
  it("converte 11,19% a.a. em taxa mensal composta", () => {
    const im = taxaAnualParaMensal(0.1119);
    expect(im).toBeCloseTo(0.008875, 5);
  });
  it("mantém consistência: (1+im)^12 = 1+ia", () => {
    const ia = 0.117;
    const im = taxaAnualParaMensal(ia);
    expect(Math.pow(1 + im, 12) - 1).toBeCloseTo(ia, 10);
  });
});

describe("calcularSac", () => {
  const r = calcularSac(400000, 0.1119, 360);
  it("primeira parcela SAC bate com referência auditada (~R$ 4.839)", () => {
    // Referência LARYA (R$400k, 360m, Caixa 11,19% SAC) ≈ R$ 4.839
    expect(r.primeiraParcela).toBeGreaterThan(4700);
    expect(r.primeiraParcela).toBeLessThan(4950);
  });
  it("amortização é constante e parcela decrescente", () => {
    expect(r.parcelas[0].amortizacao).toBeCloseTo(r.parcelas[1].amortizacao, 2);
    expect(r.primeiraParcela).toBeGreaterThan(r.ultimaParcela);
  });
  it("zera o saldo devedor ao final", () => {
    expect(r.parcelas[r.parcelas.length - 1].saldoDevedor).toBeCloseTo(0, 2);
  });
  it("total pago = financiado + juros", () => {
    expect(r.totalPago).toBeCloseTo(r.valorFinanciado + r.totalJuros, 0);
  });
});

describe("calcularPrice", () => {
  const r = calcularPrice(400000, 0.1119, 360);
  it("parcela é fixa (primeira = última)", () => {
    expect(r.primeiraParcela).toBeCloseTo(r.ultimaParcela, 1);
  });
  it("PRICE tem parcela inicial menor que SAC", () => {
    const sac = calcularSac(400000, 0.1119, 360);
    expect(r.primeiraParcela).toBeLessThan(sac.primeiraParcela);
  });
  it("zera o saldo ao final", () => {
    expect(r.parcelas[r.parcelas.length - 1].saldoDevedor).toBeCloseTo(0, 2);
  });
});

describe("simular", () => {
  it("delega corretamente para SAC/PRICE", () => {
    expect(simular(100000, 0.1, 120, "SAC").sistema).toBe("SAC");
    expect(simular(100000, 0.1, 120, "PRICE").sistema).toBe("PRICE");
  });
});

describe("analisarRenda", () => {
  it("aprova quando parcela <= 30% da renda", () => {
    const a = analisarRenda(2000, 10000)!;
    expect(a.aprovavel).toBe(true);
    expect(a.parcelaMaxima).toBe(3000);
  });
  it("reprova quando parcela > 30% da renda", () => {
    const a = analisarRenda(3500, 10000)!;
    expect(a.aprovavel).toBe(false);
  });
});

describe("limites de idade", () => {
  it("idadeEmMeses calcula corretamente", () => {
    const hoje = new Date("2026-07-07T12:00:00");
    expect(idadeEmMeses("1996-07-07", hoje)).toBe(360); // 30 anos
  });
  it("prazoMaximoPorIdade = 966 - idade em meses", () => {
    const hoje = new Date("2026-07-07T12:00:00");
    const meses = idadeEmMeses("1986-07-07", hoje)!; // 40 anos = 480m
    expect(prazoMaximoPorIdade("1986-07-07", hoje)).toBe(IDADE_FINAL_MAX_MESES - meses);
  });
  it("reprova menor de 18 anos", () => {
    const hoje = new Date("2026-07-07T12:00:00");
    const a = analisarIdade("2015-01-01", hoje)!;
    expect(a.elegivel).toBe(false);
  });
  it("aprova adulto com prazo suficiente", () => {
    const hoje = new Date("2026-07-07T12:00:00");
    const a = analisarIdade("1990-01-01", hoje)!;
    expect(a.elegivel).toBe(true);
    expect(a.prazoMaxMeses).toBeGreaterThan(400);
  });
});

describe("enquadrarMCMV", () => {
  it("renda R$ 8.000 cai na Faixa 3", () => {
    const e = enquadrarMCMV(8000, 380000);
    expect(e.faixa?.id).toBe(3);
    expect(e.elegivel).toBe(true);
  });
  it("renda R$ 12.000 cai na Faixa 4", () => {
    const e = enquadrarMCMV(12000, 550000);
    expect(e.faixa?.id).toBe(4);
    expect(e.elegivel).toBe(true);
  });
  it("renda acima de R$ 13.000 não se enquadra", () => {
    const e = enquadrarMCMV(15000, 500000);
    expect(e.elegivel).toBe(false);
    expect(e.faixa).toBeNull();
  });
  it("imóvel acima do teto da faixa gera alerta", () => {
    const e = enquadrarMCMV(8000, 500000); // Faixa 3 teto 400k
    expect(e.elegivel).toBe(false);
    expect(e.alertas.length).toBeGreaterThan(0);
  });
  it("Faixa 1 não é simulável", () => {
    const e = enquadrarMCMV(2000, 200000);
    expect(e.faixa?.id).toBe(1);
    expect(e.elegivel).toBe(false);
  });
});
