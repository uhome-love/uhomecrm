import { describe, expect, it } from "vitest";
import { periodoMesAno } from "./periodoMesAno";
import { chaveEmpreendimento } from "./vendasRelatorio";
import { exigeDocumentosVenda } from "./vendaConfirmacao";

describe("atalho mês/ano", () => {
  it("outubro 2026 = 01 a 31/10", () => expect(periodoMesAno(2026, 10)).toEqual({ start: "2026-10-01", end: "2026-10-31" }));
  it("fevereiro bissexto", () => expect(periodoMesAno(2028, 2).end).toBe("2028-02-29"));
  it("ano inteiro", () => expect(periodoMesAno(2026, 0)).toEqual({ start: "2026-01-01", end: "2026-12-31" }));
});
describe("filtro empreendimento unificado", () => {
  it("Open Bosque - v4 = Open Bosque", () => expect(chaveEmpreendimento("Open Bosque - v4")).toBe(chaveEmpreendimento("open  bosque")));
  it("acentos", () => expect(chaveEmpreendimento("Alto Lindóia")).toBe(chaveEmpreendimento("Alto Lindoia")));
});
describe("pendência só para vendas a partir de 22/10/2026", () => {
  it("antiga não exige", () => expect(exigeDocumentosVenda("2026-10-21")).toBe(false));
  it("nova exige", () => expect(exigeDocumentosVenda("2026-10-22")).toBe(true));
});
