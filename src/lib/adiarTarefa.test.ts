import { describe, it, expect } from "vitest";
import { dataAdiada } from "./adiarTarefa";

describe("adiar tarefa", () => {
  it("amanhã", () => expect(dataAdiada("2026-10-21", 1)).toBe("2026-10-22"));
  it("2 dias virando o mês", () => expect(dataAdiada("2026-10-31", 2)).toBe("2026-11-02"));
  it("próxima semana", () => expect(dataAdiada("2026-12-28", 7)).toBe("2027-01-04"));
});
