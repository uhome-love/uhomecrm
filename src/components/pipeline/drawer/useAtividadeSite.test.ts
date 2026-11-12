import { describe, it, expect } from "vitest";
import { resumirAtividadeSite, type EventoSite } from "./useAtividadeSite";
const ev = (tipo: string, dados: Record<string, unknown>, at: string): EventoSite => ({ id: at + tipo, tipo, dados, pagina: null, created_at: at });
describe("temperatura no site", () => {
  it("uma visita só não esquenta", () => {
    expect(resumirAtividadeSite([ev("visitou_imovel", { imovel_titulo: "A" }, "2026-11-10T15:00:00Z")]).esquentando).toBe(false);
  });
  it("mesmo imóvel 2x esquenta", () => {
    const r = resumirAtividadeSite([ev("visitou_imovel", { imovel_titulo: "A" }, "2026-11-10T15:00:00Z"), ev("visitou_imovel", { imovel_titulo: "A" }, "2026-11-10T16:00:00Z")]);
    expect(r.esquentando).toBe(true);
  });
  it("voltar em 2 dias esquenta", () => {
    const r = resumirAtividadeSite([ev("visitou_imovel", { imovel_titulo: "A" }, "2026-11-10T15:00:00Z"), ev("buscou_ia", { query: "x" }, "2026-11-11T15:00:00Z")]);
    expect(r.diasDistintos).toBe(2); expect(r.esquentando).toBe(true);
  });
  it("clicar no contato esquenta", () => {
    expect(resumirAtividadeSite([ev("clicou_contato", {}, "2026-11-10T15:00:00Z")]).esquentando).toBe(true);
  });
});
