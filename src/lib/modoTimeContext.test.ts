import { describe, expect, it } from "vitest";
import { modoTimeContext } from "./modoTimeContext";

describe("contexto acompanha as linhas do Modo Time", () => {
  it("soma somente os totais da tabela autorizada do time, não o Kanban", () => {
    const rows = [83, 57, 37, 33, 38, 13, 6, 11, 37, 5, 163, 6].map(total_leads => ({ total_leads }));
    expect(modoTimeContext(rows, false)).toBe("Time · 489 no resumo");
  });

  it("trocar para carteira própria usa somente a linha exibida do gerente", () => {
    expect(modoTimeContext([{ total_leads: 6 }], true)).toBe("Meus leads · 6 no resumo");
  });

  it("lista vazia permanece zero sem reutilizar o total anterior", () => {
    expect(modoTimeContext([], false)).toBe("Time · 0 no resumo");
  });
});