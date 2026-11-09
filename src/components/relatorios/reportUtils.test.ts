import { afterEach, describe, expect, it, vi } from "vitest";
import { getDateRange, type ReportFilters } from "./reportUtils";
const filtros = (periodo: string): ReportFilters => ({ periodo, equipe: "", corretor: "", segmento: "" });
afterEach(() => vi.useRealTimers());
describe("Períodos da Oferta Ativa em BRT", () => {
  it("domingo 08/11 às 22:49 pertence a domingo e à semana atual", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-09T01:49:00Z"));
    const hoje = getDateRange(filtros("hoje"));
    expect(hoje.startDate.toISOString()).toBe("2026-11-08T03:00:00.000Z");
    expect(hoje.endDate.toISOString()).toBe("2026-11-09T02:59:59.999Z");
    expect(getDateRange(filtros("semana")).startDate.toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });
  it("segunda começa somente às 03:00 UTC", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-09T03:00:00Z"));
    expect(getDateRange(filtros("semana")).startDate.toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });
  it("período informado usa BRT incluindo o fim do dia", () => {
    const r = getDateRange({ ...filtros("custom"), dataInicio: "2026-11-02", dataFim: "2026-11-08" });
    expect(r.startDate.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(r.endDate.toISOString()).toBe("2026-11-09T02:59:59.999Z");
  });
});