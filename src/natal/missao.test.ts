import { describe, expect, it } from "vitest";
import { metaValida, ritmo, segundaDaSemana, visitasParaVgv } from "./missao";

describe("missão de Natal", () => {
  it("meta mínima de R$ 1 milhão", () => {
    expect(metaValida(999_999)).toBe(false);
    expect(metaValida(1_000_000)).toBe(true);
  });
  it("1 venda de R$ 649 mil a cada 13,4 visitas", () => {
    expect(visitasParaVgv(649_000)).toBe(14);
    expect(visitasParaVgv(1_000_000)).toBe(21);
  });
  it("ritmo divide pelas semanas até 18/12", () => {
    const r = ritmo(1_000_000, 0, "2026-12-12");
    expect(r.semanas).toBe(1);
    expect(r.porSemana).toBe(21);
    expect(ritmo(1_000_000, 1_200_000, "2026-11-10").visitas).toBe(0);
  });
  it("semana começa na segunda", () => {
    expect(segundaDaSemana("2026-11-08")).toBe("2026-11-02");
    expect(segundaDaSemana("2026-11-02")).toBe("2026-11-02");
  });
});
