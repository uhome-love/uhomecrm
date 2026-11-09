import { describe, it, expect } from "vitest";
import { metaValida, resultadosDaOrigem, foneInternacional } from "./tipos";

describe("Oferta Ativa — regras", () => {
  it("meta de ligações nunca fica abaixo de 30", () => {
    expect(metaValida(10)).toBe(30);
    expect(metaValida(45)).toBe(45);
  });
  it("Bolsão não registra número errado; Listas sim", () => {
    expect(resultadosDaOrigem("estagnados")).not.toContain("numero_errado");
    expect(resultadosDaOrigem("listas")).toContain("numero_errado");
  });
  it("telefone ganha DDI 55 para ligar", () => {
    expect(foneInternacional("(51) 98223-3295")).toBe("5551982233295");
    expect(foneInternacional("123")).toBe("");
  });
});
