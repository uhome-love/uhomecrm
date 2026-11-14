import { describe, it, expect } from "vitest";
import { interesseDeclarado } from "./interesseDeclarado";
describe("interesseDeclarado", () => {
  it("texto citando POA em disparo de Canoas vira interesse declarado", () => {
    expect(interesseDeclarado("Quero ver em POA", "Casa Tua Canoas", "texto")).toBe("Interesse declarado: imóvel em Porto Alegre");
  });
  it("mesma cidade do produto mantém o produto", () => {
    expect(interesseDeclarado("quero em Canoas", "Casa Tua Canoas", "texto")).toBeNull();
  });
  it("botão sempre mantém o produto", () => {
    expect(interesseDeclarado("Porto Alegre", "Casa Tua Canoas", "botão")).toBeNull();
  });
  it("texto sem cidade mantém o produto", () => {
    expect(interesseDeclarado("Sim, tenho interesse", "Casa Tua Canoas", "texto")).toBeNull();
  });
});
