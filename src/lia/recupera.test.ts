import { describe, it, expect } from "vitest";
import { grupoDoBalde } from "./recupera";
import { campanhaVigente, precoAPartir, PRODUTOS_NATAL } from "./catalogoNatal";

describe("Lia Recupera — regras", () => {
  it("não atende entra na recuperação", () => expect(grupoDoBalde("nao_atende")).toBe("entra"));
  it("sem condição financeira espera 90 dias", () => expect(grupoDoBalde("sem_condicao_financeira")).toBe("espera_90"));
  it("desistiu espera 90 dias", () => expect(grupoDoBalde("desistiu_compra")).toBe("espera_90"));
  it("quem não quer contato nunca entra", () => expect(grupoDoBalde("nao_quer_contato")).toBe("nunca"));
  it("campanha vale até 18/12 e não em 19/12", () => {
    expect(campanhaVigente("2026-12-18")).toBe(true);
    expect(campanhaVigente("2026-12-19")).toBe(false);
  });
  it("são 8 produtos e Open Bosque parte de R$ 240 mil", () => {
    expect(PRODUTOS_NATAL).toHaveLength(8);
    expect(precoAPartir(PRODUTOS_NATAL.find((p) => p.slug === "open-bosque")!)).toBe(240000);
  });
  it("Casa Tua Porto Alegre parte de R$ 520 mil", () => {
    expect(precoAPartir(PRODUTOS_NATAL.find((p) => p.slug === "casa-tua-porto-alegre")!)).toBe(520000);
  });
});
