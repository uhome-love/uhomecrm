import { describe, expect, it } from "vitest";
import { hojeBRT, vendasNovas } from "./mural";

describe("comemoração de venda", () => {
  it("primeira abertura não comemora vendas antigas", () => {
    expect(vendasNovas(["a", "b"], null)).toEqual({ novas: [], vistas: ["a", "b"] });
  });
  it("comemora só a venda que ainda não foi vista, uma vez", () => {
    const r = vendasNovas(["c", "a", "b"], ["a", "b"]);
    expect(r.novas).toEqual(["c"]);
    expect(vendasNovas(["c", "a", "b"], r.vistas).novas).toEqual([]);
  });
  it("hoje usa horário de Brasília", () => {
    expect(hojeBRT(new Date("2026-11-03T02:00:00Z"))).toBe("2026-11-02");
  });
});
