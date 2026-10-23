import { describe, it, expect } from "vitest";
import { fmtVisitas, somarVisitasPorCliente } from "./visitasRoleta";

describe("contagem de visitas da Roleta", () => {
  it("visita sem parceria conta 1", () => {
    expect(somarVisitasPorCliente([{ cliente: "a", parceria: false }])).toBe(1);
  });
  it("visita em parceria conta 0,5", () => {
    expect(somarVisitasPorCliente([{ cliente: "a", parceria: true }])).toBe(0.5);
  });
  it("mesmo cliente duas vezes na semana conta 1 só", () => {
    expect(somarVisitasPorCliente([{ cliente: "a", parceria: false }, { cliente: "a", parceria: false }])).toBe(1);
    expect(somarVisitasPorCliente([{ cliente: "j", parceria: true }, { cliente: "j", parceria: true }])).toBe(0.5);
  });
  it("1 própria + 2 em parceria atinge a meta 2", () => {
    expect(somarVisitasPorCliente([
      { cliente: "a", parceria: false }, { cliente: "b", parceria: true }, { cliente: "c", parceria: true },
    ])).toBe(2);
  });
  it("formata com vírgula", () => {
    expect(fmtVisitas(1.5)).toBe("1,5");
    expect(fmtVisitas(2)).toBe("2");
  });
});
