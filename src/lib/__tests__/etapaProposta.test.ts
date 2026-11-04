import { describe, it, expect, vi } from "vitest";
vi.stubGlobal("AudioContext", class { createOscillator() { return {}; } createGain() { return {}; } });
import { PIPELINE_STAGE_EMOJIS, PIPELINE_STAGE_COLORS, PIPELINE_STAGE_BG } from "@/lib/celebrations";
import { getCategoriasForStage } from "@/lib/stageToCategoria";
import { ETAPAS_NEGOCIO, ETAPA_NEGOCIO_LABEL } from "@/lib/negocioEtapa";

describe("Etapa Proposta (antiga Em Negociação)", () => {
  it("negócios são Documentação, Proposta, Contrato e Ganho", () => {
    expect(ETAPAS_NEGOCIO.map((e) => ETAPA_NEGOCIO_LABEL[e])).toEqual(["Documentação", "Proposta", "Contrato", "Ganho"]);
  });
  it("nome novo e antigo têm o mesmo ícone, cor e roteiros", () => {
    expect(PIPELINE_STAGE_EMOJIS["Proposta"]).toBe(PIPELINE_STAGE_EMOJIS["Em Negociação"]);
    expect(PIPELINE_STAGE_COLORS["Proposta"]).toBe(PIPELINE_STAGE_COLORS["Em Negociação"]);
    expect(PIPELINE_STAGE_BG["Proposta"]).toEqual(PIPELINE_STAGE_BG["Em Negociação"]);
    expect(getCategoriasForStage("Proposta")).toEqual(getCategoriasForStage("Em Negociação"));
    expect(getCategoriasForStage("Proposta").length).toBeGreaterThan(0);
  });
});
