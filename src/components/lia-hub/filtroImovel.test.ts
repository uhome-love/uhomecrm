import { describe, expect, it } from "vitest";
import { chaveImovel, produtoLabel, produtosDeEstados, SEM_IMOVEL } from "./useLiaHub";

describe("filtro de imóvel da Lia", () => {
  it("nunca lista curadoria ou flow como imóvel", () => {
    const lista = produtosDeEstados([
      { produto_slug: "curadoria" }, { produto_slug: "flow" }, { produto_slug: null },
      { produto_slug: "casa-tua-canoas" },
    ]);
    expect(lista).toEqual(["casa-tua-canoas", SEM_IMOVEL]);
  });
  it("curadoria e flow viram 'Sem imóvel definido'", () => {
    expect(chaveImovel("curadoria")).toBe(SEM_IMOVEL);
    expect(produtoLabel("flow")).toBe("Sem imóvel definido");
    expect(produtoLabel("open-bosque")).toBe("Open Bosque");
  });
});
