import { describe, it, expect } from "vitest";
import { normalizarTemperatura, TEMPERATURAS } from "./temperatura";

describe("temperatura em três níveis", () => {
  it("a escala tem só Frio, Morno e Quente", () => {
    expect(TEMPERATURAS).toEqual(["frio", "morno", "quente"]);
  });
  it("Muito quente e Urgente antigos viram Quente", () => {
    expect(normalizarTemperatura("muito_quente")).toBe("quente");
    expect(normalizarTemperatura("urgente")).toBe("quente");
  });
  it("Gelado vira Frio; vazio fica sem temperatura", () => {
    expect(normalizarTemperatura("gelado")).toBe("frio");
    expect(normalizarTemperatura(null)).toBe("nao_definida");
    expect(normalizarTemperatura("nao_definida")).toBe("nao_definida");
  });
});
