import { describe, it, expect } from "vitest";
import { telefoneForaDoRS } from "@/lib/dddUf";
import { buracosSemRegistro, direcaoEtapa } from "@/lib/timelineNarrativa";

describe("ficha do lead", () => {
  it("mostra DDD só quando é de fora do RS", () => {
    expect(telefoneForaDoRS("44999344895")?.uf).toBe("PR");
    expect(telefoneForaDoRS("5551999990000")).toBeNull();
  });
  it("marca buraco de 7 dias ou mais entre registros", () => {
    const m = buracosSemRegistro([{ date: "2026-11-01T12:00:00Z" }, { date: "2026-10-23T12:00:00Z" }, { date: "2026-10-20T12:00:00Z" }]);
    expect(m.get(0)).toBe(9);
    expect(m.has(1)).toBe(false);
  });
  it("detecta volta de etapa", () => {
    const st = [{ id: "a", ordem: 1 }, { id: "b", ordem: 2 }];
    expect(direcaoEtapa(st, "b", "a")).toBe("voltou");
    expect(direcaoEtapa(st, "a", "b")).toBe("avancou");
  });
});
