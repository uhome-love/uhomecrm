import { describe, it, expect } from "vitest";
import { isNatal, diasAte18 } from "./config";
describe("campanha de Natal", () => {
  it("decoração de 02/11 até 31/12/2026 (fechamento do ano)", () => {
    expect(isNatal("2026-11-01")).toBe(false);
    expect(isNatal("2026-11-02")).toBe(true);
    expect(isNatal("2026-12-31")).toBe(true);
    expect(isNatal("2027-01-01")).toBe(false);
  });
  it("contagem até 18/12", () => {
    expect(diasAte18("2026-11-03")).toBe(45);
    expect(diasAte18("2026-12-20")).toBe(0);
  });
});
