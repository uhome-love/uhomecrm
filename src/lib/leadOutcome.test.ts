import { describe, it, expect } from "vitest";
import { buildMotivoDescarte } from "./leadOutcome";

describe("buildMotivoDescarte", () => {
  it("prefixa 'Descartado:' para reengajável", () => {
    expect(buildMotivoDescarte("reengajavel", "Sem condição financeira")).toBe(
      "Descartado: Sem condição financeira",
    );
  });

  it("prefixa 'Inativado:' para definitivo", () => {
    expect(buildMotivoDescarte("definitivo", "Solicitou retirada (LGPD)")).toBe(
      "Inativado: Solicitou retirada (LGPD)",
    );
  });

  it("preserva texto livre com pontuação no label", () => {
    expect(buildMotivoDescarte("definitivo", "morreu, infelizmente")).toBe(
      "Inativado: morreu, infelizmente",
    );
  });

  it("aceita label que já contém ':' sem deformar", () => {
    expect(buildMotivoDescarte("reengajavel", "Outro: morreu")).toBe(
      "Descartado: Outro: morreu",
    );
  });

  it("trim espaços do label", () => {
    expect(buildMotivoDescarte("reengajavel", "  Sem interesse  ")).toBe(
      "Descartado: Sem interesse",
    );
  });

  it("fallback quando label vazio", () => {
    expect(buildMotivoDescarte("definitivo", "")).toBe(
      "Inativado: Sem motivo informado",
    );
  });
});
