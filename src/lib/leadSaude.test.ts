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
