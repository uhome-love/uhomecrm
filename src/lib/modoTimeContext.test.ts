import { describe, expect, it } from "vitest";
import { totalModoTime } from "./modoTimeContext";

describe("contexto acompanha as linhas do Modo Time", () => {
  it("soma somente os totais da tabela autorizada do time, não o Kanban", () => {
    const rows = [83, 57, 37, 33, 38, 13, 6, 11, 37, 5, 163, 6].map(total_leads => ({ total_leads }));
    expect(totalModoTime(rows)).toBe(489);
  });

  it("trocar para carteira própria usa somente a linha exibida do gerente", () => {
    expect(totalModoTime([{ total_leads: 6 }])).toBe(6);
  });

  it("lista vazia permanece zero sem reutilizar o total anterior", () => {
    expect(totalModoTime([])).toBe(0);
  });
});