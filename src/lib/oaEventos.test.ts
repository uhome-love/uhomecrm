import { describe, expect, it } from "vitest";
import { normalizarLigacoesMutirao, type MutiraoEvento } from "./oaEventos";

const evento = (resultado: string, origem = "mutirao"): MutiraoEvento => ({
  id: resultado + origem, pipeline_lead_id: "lead-teste", corretor_id: "profile-teste",
  resultado, origem, pontos: 0, created_at: "2026-11-09T01:49:00Z",
});
const ids = new Map([["profile-teste", "auth-teste"]]);

describe("Ligaçōes unificadas da Arena", () => {
  it("atribui o Mutirão ao mesmo auth ID usado nas listas", () => {
    expect(normalizarLigacoesMutirao([evento("nao_atendeu")], ids)[0]?.corretor_id).toBe("auth-teste");
  });
  it("não conta Pular como ligação", () => {
    expect(normalizarLigacoesMutirao([evento("pulado")], ids)).toHaveLength(0);
  });
  it("não inventa ligação para uma visita marcada pelo pipeline", () => {
    expect(normalizarLigacoesMutirao([evento("visita_agendada", "pipeline")], ids)).toHaveLength(0);
  });
  it("conta uma ligação do Mutirão que terminou em visita, sem duplicar o evento da agenda", () => {
    const rows = normalizarLigacoesMutirao([evento("visita_agendada"), evento("visita_agendada", "pipeline")], ids);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.resultado).toBe("com_interesse");
  });
  it("não atribui evento com profile não resolvido a outro corretor", () => {
    expect(normalizarLigacoesMutirao([evento("aproveitado")], new Map())).toHaveLength(0);
  });
});