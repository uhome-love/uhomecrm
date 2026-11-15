import { describe, it, expect } from "vitest";
import { lerSiteOrigem, classificarFonte } from "./siteOrigem";

const obsVitoria = "[Site uhome.com.br]\nOrigem: Pop-up de Saída\nPágina: https://uhome.com.br/busca?tipo=apartamento%2Cgarden%2Ccobertura%2Ccasa%2Ccasa_condominio%2Csobrado&q=Auxiliadora+Higien%C3%B3polis+bela+vista+Petr%C3%B3polis+tr%C3%AAs+figueiras&quartos=2&vagas=1&preco_max=300000\nDevice: mobile";

describe("lerSiteOrigem", () => {
  it("lê o caso Vitória: pop-up de saída, busca, filtros, bairros e celular", () => {
    const r = lerSiteOrigem({ origem_componente: "exit_intent" }, obsVitoria, null);
    expect(r.ondeClicou).toBe("Pop-up de saída");
    expect(r.paginaRotulo).toBe("Busca de imóveis");
    expect(r.filtros).toContain("2+ quartos");
    expect(r.filtros).toContain("1+ vaga");
    expect(r.filtros).toContain("até R$ 300 mil");
    expect(r.bairros).toEqual(["Auxiliadora", "Higienópolis", "Bela Vista", "Petrópolis", "Três Figueiras"]);
    expect(r.aparelho).toBe("Celular");
  });
});

describe("classificarFonte", () => {
  it("gclid é Google Ads", () => expect(classificarFonte({ gclid: "x" }, null)).toBe("Google Ads"));
  it("fbclid é Meta", () => expect(classificarFonte({ fbclid: "x" }, null)).toBe("Meta"));
  it("utm instagram é Meta", () => expect(classificarFonte({ utm_source: "instagram" }, null)).toBe("Meta"));
  it("referrer google sem clique é orgânico", () => expect(classificarFonte({ referrer: "https://www.google.com/" }, null)).toBe("Google orgânico"));
  it("referrer vazio informado é Direto", () => expect(classificarFonte({ referrer: "" }, null)).toBe("Direto"));
  it("sem nada é Não informada", () => expect(classificarFonte({}, null)).toBe("Não informada"));
});
