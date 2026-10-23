import { describe, it, expect } from "vitest";
import { contarPipelineAtivo } from "./pipelineAtivo";
const agora = new Date().toISOString();
const tipos = { a: "qualificacao", g: "venda", d: "descarte", p: "proposta" };
describe("pipeline ativo", () => {
  it("Ganho e Descarte não contam; negócio ativo conta e é separado", () => {
    const leads = [
      { stage_id: "a", ultimo_toque_at: agora }, { stage_id: "a", ultimo_toque_at: agora },
      { stage_id: "p", ultimo_toque_at: agora },
      ...Array.from({ length: 10 }, () => ({ stage_id: "g", ultimo_toque_at: agora })),
      { stage_id: "d", ultimo_toque_at: agora },
    ];
    expect(contarPipelineAtivo(leads, tipos)).toEqual({ total: 3, leads: 2, negocios: 1 });
  });
});
