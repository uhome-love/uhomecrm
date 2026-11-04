import { describe, it, expect } from "vitest";
import { PRODUTOS_NATAL, REGRAS_FINANCEIRAS } from "./catalogoNatal";
import { DESTINO_RECUPERADO, podeRepassarRecuperado } from "./recupera";

const p = (slug: string) => PRODUTOS_NATAL.find((x) => x.slug === slug)!;

describe("Lia Recupera — decisões do Lucas", () => {
  it("recuperado vai para a Fila CEO manual", () => expect(DESTINO_RECUPERADO).toBe("fila_ceo_manual"));
  it("corretor que descartou não recebe de volta", () => {
    expect(podeRepassarRecuperado("a", "a")).toBe(false);
    expect(podeRepassarRecuperado("b", "a")).toBe(true);
  });
  it("entregas confirmadas", () => {
    expect(p("casa-tua-porto-alegre").entrega).toBe("Abril de 2028");
    expect(p("casa-tua-canoas").entrega).toBe("Novembro de 2029");
    expect(p("open-bosque").entrega).toBe("Novembro de 2028");
    expect(p("skyglass-parque-moinhos").entrega).toBe("Pronto para morar");
    expect(p("boa-vista-country-club").entrega).toBe("Pronto para morar");
    expect(p("golden-lake").entrega).toContain("Lake Baikal julho de 2030");
  });
  it("Open Arvoredo: renda 7 mil (2 dorm.) e 9 mil (3 dorm.)", () => {
    expect(p("open-arvoredo").rendaReferencia).toContain("R$ 7.000 (2 dorm.)");
    expect(p("open-arvoredo").rendaReferencia).toContain("R$ 9.000 (3 dorm.)");
  });
  it("entrada 10% e FGTS com análise nos Open", () => {
    expect(REGRAS_FINANCEIRAS.entrada).toContain("10%");
    expect(REGRAS_FINANCEIRAS.fgts).toContain("Open");
  });
});
