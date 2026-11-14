import { describe, it, expect } from "vitest";
import { PIPELINE_ETAPAS } from "@/lib/pipelineEtapas";
import { etapaNegocioDoPipeline } from "@/lib/negocioEtapa";

describe("Etapas do Pipeline — verdade única", () => {
  it("tem as 10 etapas na ordem combinada", () => {
    expect(PIPELINE_ETAPAS.map((e) => e.nome)).toEqual([
      "Novo Lead", "Sem Contato", "Atendimento", "Aquecimento", "Visita",
      "Pós-Visita", "Documentação", "Proposta", "Contrato", "Ganho",
    ]);
  });

  it("não existe etapa chamada Em Negociação", () => {
    expect(PIPELINE_ETAPAS.some((e) => e.nome === "Em Negociação")).toBe(false);
  });

  it("negócio começa em Documentação; Pós-Visita ainda não é negócio", () => {
    expect(etapaNegocioDoPipeline("pos_visita")).toBeNull();
    expect(etapaNegocioDoPipeline("documentacao")).toBe("documentacao");
    expect(etapaNegocioDoPipeline("proposta")).toBe("proposta");
    expect(etapaNegocioDoPipeline("contrato_gerado")).toBe("contrato");
  });
});
