import { describe, it, expect } from "vitest";
import { assinaturaPrevistaRotulo } from "../assinaturaPrevista";
const agora = new Date("2026-11-11T15:00:00-03:00");
describe("assinatura prevista", () => {
  it("hoje", () => expect(assinaturaPrevistaRotulo("2026-11-11", agora)).toBe("hoje"));
  it("amanhã", () => expect(assinaturaPrevistaRotulo("2026-11-12", agora)).toBe("amanhã"));
  it("outra data", () => expect(assinaturaPrevistaRotulo("2026-11-20", agora)).toBe("20 nov"));
});
