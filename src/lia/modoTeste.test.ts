import { describe, it, expect } from "vitest";
import { modoTestePermite } from "../../supabase/functions/_shared/liaModoTeste";

const cfg = { modo_teste: true, numero_teste: "5551992597097" };
describe("Lia modo teste", () => {
  it("bloqueia número diferente do de teste", () => expect(modoTestePermite(cfg, "5551999990000")).toBe(false));
  it("libera o número de teste (com ou sem +55)", () => { expect(modoTestePermite(cfg, "+55 51 99259-7097")).toBe(true); expect(modoTestePermite(cfg, "51992597097")).toBe(true); });
  it("trava desligada mantém comportamento atual", () => expect(modoTestePermite({ modo_teste: false, numero_teste: null }, "5551999990000")).toBe(true));
  it("sem leitura da configuração bloqueia", () => expect(modoTestePermite(null, "5551992597097")).toBe(false));
});
