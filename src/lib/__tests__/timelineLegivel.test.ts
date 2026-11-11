import { describe, it, expect } from "vitest";
import { valorCurto, codigoLegivel, respostaFormLegivel, descricaoLegivel, iconeDoMarco } from "@/lib/timelineNarrativa";

describe("texto legível da linha do tempo", () => {
  it("valor em mi e mil", () => { expect(valorCurto(1100000)).toBe("R$ 1,1 mi"); expect(valorCurto(735000)).toBe("R$ 735 mil"); });
  it("códigos", () => { expect(codigoLegivel("em_confeccao")).toBe("Em confecção"); expect(codigoLegivel("gerado")).toBe("Gerado"); });
  it("resposta do formulário", () => { expect(respostaFormLegivel("casa_3_dorms_-_130m2")).toBe("Casa 3 dorms · 130 m²"); });
  it("contrato sem repetição", () => {
    expect(descricaoLegivel("Avulso · Unidade: avulso · Valor: 1100000 · Situação: em_confeccao · EM vistoria"))
      .toBe("Avulso · Valor: R$ 1,1 mi · Situação: Em confecção · Em vistoria");
  });
  it("cores dos marcos", () => {
    expect(iconeDoMarco({ sourceType: "historico" }, "voltou", "aquecimento").tom).toBe("laranja");
    expect(iconeDoMarco({ sourceType: "historico" }, "avancou", "venda").emoji).toBe("🏆");
    expect(iconeDoMarco({ sourceType: "historico" }, "avancou", "descarte").tom).toBe("vermelho");
    expect(iconeDoMarco({ title: "WhatsApp" }).tom).toBe("cinza");
    expect(iconeDoMarco({ title: "Visita agendada" }).emoji).toBe("📅");
  });
});
describe("faixa de renda", () => { it("tira _ de r$", () => { expect(descricaoLegivel("De r$_8.001 a r$_12.000")).toBe("De R$ 8.001 a R$ 12.000"); }); });
