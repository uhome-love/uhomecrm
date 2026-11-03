import { describe, it, expect } from "vitest";
import { lerNomeArquivo, podeGerenciar } from "./arquivos";
import { isCentralNatal } from "../config";

describe("Campanha Natal 2026 · arquivos", () => {
  it("card de empreendimento vira seção cards, ordem 1 e nome do empreendimento", () => {
    expect(lerNomeArquivo("CARD-01-Open_Bosque.jpg")).toMatchObject({ secao: "cards", ordem: 1, titulo: "Open Bosque", chave: "CARD-01-Open_Bosque", caminho: "cards/CARD-01-Open_Bosque.jpg" });
  });
  it("PDF usa o título do PDF", () => {
    expect(lerNomeArquivo("PDF-1-Encarte_de_Natal_A4_Clientes.pdf")?.titulo).toBe("Encarte de Natal para o cliente");
  });
  it("nome fora do padrão não sobe", () => {
    expect(lerNomeArquivo("foto_nova.jpg")).toBeNull();
    expect(lerNomeArquivo("CARD-01-Open.gif")).toBeNull();
  });
  it("só admin e diretor gerenciam", () => {
    expect(podeGerenciar(["admin"])).toBe(true);
    expect(podeGerenciar(["diretor"])).toBe(true);
    expect(podeGerenciar(["gestor", "corretor"])).toBe(false);
  });
  it("página fica no ar de 01/11 a 18/12", () => {
    expect(isCentralNatal("2026-11-01")).toBe(true);
    expect(isCentralNatal("2026-12-18")).toBe(true);
    expect(isCentralNatal("2026-12-19")).toBe(false);
  });
});
