import { describe, it, expect } from "vitest";
import { roteiroNatalOA } from "./roteiroOA";

describe("roteiro de Natal na Oferta Ativa", () => {
  it("usa a condição de Natal do produto da campanha", () => {
    const r = roteiroNatalOA("Open Bosque", "2026-11-09");
    expect(r?.modelo).toContain("1 dormitório a partir de R$ 240 mil");
  });
  it("reconhece Lake Eyre como Golden Lake", () => {
    expect(roteiroNatalOA("Lake Eyre", "2026-11-09")?.produto).toBe("Golden Lake");
  });
  it("não vale depois de 18/12", () => {
    expect(roteiroNatalOA("Open Bosque", "2026-12-19")).toBeNull();
  });
  it("produto fora da campanha usa roteiro normal", () => {
    expect(roteiroNatalOA("Alto Lindóia", "2026-11-09")).toBeNull();
  });
});
