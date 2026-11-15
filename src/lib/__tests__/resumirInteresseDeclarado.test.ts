import { describe, it, expect } from "vitest";
import { resumirInteresseDeclarado as r } from "../resumirInteresseDeclarado";

describe("resumirInteresseDeclarado", () => {
  it("resume o interesse longo da busca", () => {
    expect(r("Interesse declarado: apartamento/garden/cobertura/casa/casa condominio/sobrado, 2+ quartos, 1+ vaga(s), até R$ 300 mil em Auxiliadora Higienópolis Bela Vista")).toBe(
      "Interesse: Apto Auxiliadora até 300mil",
    );
  });
  it("mantém cidade", () => {
    expect(r("Interesse declarado: imóvel em Porto Alegre")).toBe("Interesse: Imóvel Porto Alegre");
  });
  it("milhão vira mi", () => {
    expect(r("Interesse declarado: casa condominio, até R$ 1,2 milhão em Canoas")).toBe("Interesse: Casa cond. Canoas até 1,2mi");
  });
  it("produto normal não muda", () => {
    expect(r("Casa Tua Canoas")).toBe("Casa Tua Canoas");
  });
});
