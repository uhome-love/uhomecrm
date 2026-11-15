import { describe, it, expect } from "vitest";
import { resumirInteresseDeclarado as r } from "../resumirInteresseDeclarado";

describe("resumirInteresseDeclarado", () => {
  it("resume o interesse longo da busca", () => {
    expect(r("Interesse declarado: apartamento/garden/cobertura/casa/casa condominio/sobrado, 2+ quartos, 1+ vaga(s), até R$ 300 mil em Auxiliadora Higienópolis Bela Vista")).toBe(
      "Interesse do site · Apartamento +5 tipos · Auxiliadora +mais · até R$ 300 mil",
    );
  });
  it("mantém cidade", () => {
    expect(r("Interesse declarado: imóvel em Porto Alegre")).toBe("Interesse do site · Imóvel · Porto Alegre");
  });
  it("produto normal não muda", () => {
    expect(r("Casa Tua Canoas")).toBe("Casa Tua Canoas");
  });
});
