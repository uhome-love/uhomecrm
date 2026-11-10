import { describe, it, expect } from "vitest";
import { montarCaminho } from "./CaminhoDoLead";
const stages = [{ id: "n", nome: "Novo Lead", ordem: 0 }, { id: "s", nome: "Sem Contato", ordem: 1 }, { id: "q", nome: "Qualificação", ordem: 2 }];
describe("montarCaminho", () => {
  it("esconde ida e volta no mesmo dia", () => {
    const p = montarCaminho([
      { stage_anterior_id: "n", stage_novo_id: "s", created_at: "2026-10-14T12:00:00Z" },
      { stage_anterior_id: "s", stage_novo_id: "n", created_at: "2026-10-14T13:00:00Z" },
      { stage_anterior_id: "n", stage_novo_id: "s", created_at: "2026-10-14T14:00:00Z" },
    ], stages, "2026-10-11T12:00:00Z");
    expect(p.map((x) => x.stageId)).toEqual(["n", "s"]);
  });
  it("marca volta quando a etapa nova vem antes", () => {
    const p = montarCaminho([
      { stage_anterior_id: "n", stage_novo_id: "q", created_at: "2026-10-14T12:00:00Z" },
      { stage_anterior_id: "q", stage_novo_id: "s", created_at: "2026-10-20T12:00:00Z" },
    ], stages, null);
    expect(p[p.length - 1].voltou).toBe(true);
  });
});
describe("montarCaminho com etapa sem registro de entrada", () => {
  it("usa a etapa de origem do movimento para saber se voltou", () => {
    const st = [...stages, { id: "a", nome: "Aquecimento", ordem: 3 }, { id: "p", nome: "Pós-Visita", ordem: 5 }];
    const p = montarCaminho([
      { stage_anterior_id: "n", stage_novo_id: "q", created_at: "2026-10-20T12:00:00Z" },
      { stage_anterior_id: "p", stage_novo_id: "a", created_at: "2026-11-01T12:00:00Z" },
    ], st, null);
    expect(p.map((x) => x.stageId)).toEqual(["n", "q", "p", "a"]);
    expect(p[3].voltou).toBe(true);
  });
});
import { partesDaVisita } from "../LeadHistoricoTab";
describe("partesDaVisita", () => {
  it("separa resultado, temperatura e observação sem emoji", () => {
    const p = partesDaVisita("23/10/2026 · 11:00 · Imóvel: Terrace · Resultado: 🔥 Quer proposta · Temperatura: 🔥 Muito quente · vai mandar docs");
    expect(p).toMatchObject({ dia: "23 out", hora: "11:00", imovel: "Terrace", resultado: "Quer proposta", temperatura: "Muito quente", obs: ["vai mandar docs"] });
  });
});
