import { describe, it, expect } from "vitest";
import { etapaNegocioDoPipeline } from "./negocioEtapa";

describe("régua única de negócios", () => {
  it("pós-visita ainda não é negócio", () => {
    expect(etapaNegocioDoPipeline("pos_visita")).toBeNull();
  });
  it("documentação, proposta e contrato são negócio em andamento", () => {
    expect(etapaNegocioDoPipeline("documentacao")).toBe("documentacao");
    expect(etapaNegocioDoPipeline("proposta")).toBe("proposta");
    expect(etapaNegocioDoPipeline("contrato_gerado")).toBe("contrato");
  });
  it("venda é ganho; descarte e visita não são negócio", () => {
    expect(etapaNegocioDoPipeline("venda")).toBe("ganho");
    expect(etapaNegocioDoPipeline("descarte")).toBeNull();
    expect(etapaNegocioDoPipeline("visita")).toBeNull();
  });
});
