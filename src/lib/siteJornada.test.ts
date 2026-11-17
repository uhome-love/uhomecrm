import { describe, it, expect } from "vitest";
import { lerEventos, lerJornada, agruparSessoes } from "./siteJornada";
const agora = new Date("2026-11-17T12:00:00Z");
const ev = (id: string, tipo: string, quando: string, extra: Record<string, unknown> = {}) =>
  ({ event_id: id, session_id: "s1", tipo, pagina: "/x", imovel: { slug: null, titulo: null }, dados: {}, quando, is_bot: false, ...extra });

describe("siteJornada", () => {
  it("deduplica pelo event_id e usa só a lista da jornada", () => {
    const e = [ev("a", "imovel_visto", "2026-11-17T10:00:00Z"), ev("a", "imovel_visto", "2026-11-17T10:00:00Z")];
    const r = lerEventos({ jornada: { site_events: e }, site_events: [...e, ev("b", "busca_feita", "2026-11-17T10:01:00Z")] }, agora);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });
  it("ignora robôs", () => {
    expect(lerEventos({ site_events: [ev("a", "pagina_vista", "2026-11-17T10:00:00Z", { is_bot: true })] }, agora)).toHaveLength(0);
  });
  it("alias equivalente na mesma sessão e minuto não conta de novo", () => {
    const r = lerEventos({ site_events: [ev("b", "imovel_visualizado", "2026-11-17T10:00:20Z"), ev("a", "imovel_visto", "2026-11-17T10:00:05Z")] }, agora);
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe("imovel_visto");
  });
  it("alias sozinho vira nome novo", () => {
    expect(lerEventos({ site_events: [ev("b", "whatsapp_click", "2026-11-17T10:00:00Z")] }, agora)[0].tipo).toBe("whatsapp_tocado");
  });
  it("corta eventos com mais de 90 dias", () => {
    expect(lerEventos({ site_events: [ev("a", "pagina_vista", "2026-08-01T10:00:00Z")] }, agora)).toHaveLength(0);
  });
  it("agrupa por sessão e junta páginas seguidas", () => {
    const evs = lerEventos({ site_events: [
      ev("a", "pagina_vista", "2026-11-17T10:00:00Z"), ev("b", "pagina_vista", "2026-11-17T10:01:00Z"),
      ev("c", "rolagem_50", "2026-11-17T10:02:00Z"), ev("d", "pagina_vista", "2026-11-17T11:00:00Z", { session_id: "s2" }),
    ] }, agora);
    const s = agruparSessoes(evs);
    expect(s.map((x) => x.id)).toEqual(["s2", "s1"]);
    expect(s[1].eventos).toHaveLength(1);
    expect(s[1].eventos[0].dados._n).toBe(2);
  });
  it("lead antigo sem jornada retorna null", () => {
    expect(lerJornada({ utm_source: "google" }, agora)).toBeNull();
  });
});
