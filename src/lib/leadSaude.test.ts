import { describe, it, expect } from "vitest";
import { leadSaude } from "./leadSaude";

const diasAtras = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const saude = (tipo: string, d: number) => leadSaude({ stage_tipo: tipo, distribuido_em: diasAtras(d) });

describe("cores do lead", () => {
  it("aquecimento: verde, amarelo, vermelho e estagnado", () => {
    expect(saude("aquecimento", 10)).toBe("verde");
    expect(saude("aquecimento", 17)).toBe("ambar");
    expect(saude("aquecimento", 20)).toBe("vermelho");
    expect(saude("aquecimento", 22)).toBe("estagnado");
  });
  it("qualificação continua igual", () => {
    expect(saude("qualificacao", 5)).toBe("verde");
    expect(saude("qualificacao", 12)).toBe("ambar");
    expect(saude("qualificacao", 18)).toBe("vermelho");
    expect(saude("qualificacao", 22)).toBe("estagnado");
  });
  it("sem contato continua igual", () => {
    expect(saude("sem_contato", 3)).toBe("ambar");
    expect(saude("sem_contato", 10)).toBe("vermelho");
    expect(saude("sem_contato", 16)).toBe("estagnado");
  });
  it("toda etapa que estagna fica vermelha no dia anterior", () => {
    for (const [tipo, lim] of [["sem_contato", 15], ["qualificacao", 21], ["aquecimento", 21]] as const) {
      expect(saude(tipo, lim - 0.5)).toBe("vermelho");
    }
  });
});

describe("lead que volta com distribuição antiga", () => {
  it("aceite de hoje com toque e distribuição antigos fica verde", async () => {
    const { leadSaude } = await import("./leadSaude");
    const agora = new Date().toISOString();
    expect(leadSaude({
      ultimo_toque_at: "2026-05-22T18:49:13Z",
      distribuido_em: "2026-03-15T17:51:02Z",
      aceito_em: agora,
      created_at: "2026-03-15T11:52:06Z",
      stage_tipo: "sem_contato",
    })).toBe("verde");
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { leadSaude as ls2 } from "./leadSaude";
d2("ação futura", () => {
  const velho = new Date(Date.now() - 30 * 86_400_000).toISOString();
  i2("lead com visita/tarefa futura fica em dia mesmo sem toque há 30 dias", () => {
    e2(ls2({ ultimo_toque_at: velho, created_at: velho, stage_tipo: "visita", tem_acao_futura: true })).toBe("verde");
  });
  i2("sem ação futura segue a regra normal", () => {
    e2(ls2({ ultimo_toque_at: velho, created_at: velho, stage_tipo: "visita" })).toBe("vermelho");
  });
  i2("etapa final continua final", () => {
    e2(ls2({ created_at: velho, stage_tipo: "venda", tem_acao_futura: true })).toBe("terminal");
  });
});
