import { describe, expect, it } from "vitest";
import { resolverPeriodo } from "./perfPeriodo";

const hoje = new Date(2026, 10, 3, 10); // terça, 03/11/2026

describe("comparação justa do período em andamento", () => {
  it("mês atual compara com o mesmo pedaço do mês anterior", () => {
    const r = resolverPeriodo({ tipo: "mes", offset: 0 }, hoje);
    expect([r.start, r.end, r.prevStart, r.prevEnd]).toEqual(["2026-11-01", "2026-11-30", "2026-10-01", "2026-10-03"]);
  });
  it("semana atual compara seg–ter com seg–ter da semana passada", () => {
    const r = resolverPeriodo({ tipo: "semana", offset: 0 }, hoje);
    expect([r.prevStart, r.prevEnd]).toEqual(["2026-10-26", "2026-10-27"]);
  });
  it("mês já fechado compara com o mês anterior inteiro", () => {
    const r = resolverPeriodo({ tipo: "mes", offset: -1 }, hoje);
    expect([r.prevStart, r.prevEnd]).toEqual(["2026-09-01", "2026-09-30"]);
  });
});
