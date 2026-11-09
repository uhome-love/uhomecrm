import { describe, it, expect } from "vitest";
import { ARENA_MINIMO, progressoDia, foraDaRoleta, marcosCruzados } from "./arenaLigacoes";

describe("Arena de Ligações", () => {
  it("mínimo diário é 30 ligações, 3 aproveitados e 1 visita", () => {
    expect(ARENA_MINIMO).toEqual({ ligacoes: 30, aproveitados: 3, visitas: 1 });
  });
  it("calcula o que falta para o mínimo", () => {
    const r = progressoDia({ ligacoes: 12, aproveitados: 1, visitas: 0 });
    expect(r.faltam).toEqual({ ligacoes: 18, aproveitados: 2, visitas: 1 });
    expect(r.completo).toBe(false);
  });
  it("mínimo completo só com as três metas", () => {
    expect(progressoDia({ ligacoes: 30, aproveitados: 3, visitas: 1 }).completo).toBe(true);
    expect(progressoDia({ ligacoes: 80, aproveitados: 9, visitas: 0 }).completo).toBe(false);
  });
  it("fora da Roleta quando nenhuma das duas semanas bateu a meta", () => {
    expect(foraDaRoleta(1, 1, 2)).toBe(true);
    expect(foraDaRoleta(2, 0, 2)).toBe(false);
    expect(foraDaRoleta(0, 2, 2)).toBe(false);
  });
  it("comemora ao cruzar 30 ligações e ao marcar visita", () => {
    const m = marcosCruzados({ ligacoes: 29, aproveitados: 0, visitas: 0 }, { ligacoes: 30, aproveitados: 0, visitas: 1 });
    expect(m).toHaveLength(2);
    expect(marcosCruzados({ ligacoes: 30, aproveitados: 0, visitas: 0 }, { ligacoes: 31, aproveitados: 0, visitas: 0 })).toHaveLength(0);
  });
});
