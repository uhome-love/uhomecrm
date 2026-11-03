import { describe, expect, it } from "vitest";
import { datasDoPeriodo, periodoAtivo } from "./periodoPadraoDatas";

describe("datasDoPeriodo", () => {
  it("semana começa na segunda anterior, inclusive no domingo", () => {
    expect(datasDoPeriodo("semana", "2026-11-03")).toEqual({ inicio: "2026-11-02", fim: "2026-11-03" });
    expect(datasDoPeriodo("semana", "2026-11-08")).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" });
  });
  it("mês vai do dia 1 até hoje e ontem atravessa o mês", () => {
    expect(datasDoPeriodo("mes", "2026-11-03")).toEqual({ inicio: "2026-11-01", fim: "2026-11-03" });
    expect(datasDoPeriodo("ontem", "2026-11-01")).toEqual({ inicio: "2026-10-31", fim: "2026-10-31" });
  });
  it("intervalo livre vira personalizado", () => {
    expect(periodoAtivo("2026-10-01", "2026-10-31", "2026-11-03")).toBe("personalizado");
    expect(periodoAtivo("2026-11-01", "2026-11-03", "2026-11-03")).toBe("mes");
  });
});
