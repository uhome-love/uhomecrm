import { describe, it, expect } from "vitest";
import { resolverArea } from "./liaAreas";

describe("resolverArea", () => {
  it("aba antiga qualificados abre Relatórios", () => {
    expect(resolverArea(null, "qualificados").area.valor).toBe("relatorios");
  });
  it("aba antiga kanban abre Conversas na seção kanban", () => {
    const r = resolverArea(null, "kanban");
    expect(r.area.valor).toBe("conversas");
    expect(r.secao).toBe("kanban");
  });
  it("sem parâmetros abre Visão geral", () => {
    expect(resolverArea(null, null).area.valor).toBe("visao");
  });
  it("área sem aba abre a primeira seção", () => {
    expect(resolverArea("cerebro", null).secao).toBe("conhecimento");
  });
});
