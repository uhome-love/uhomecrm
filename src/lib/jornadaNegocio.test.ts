import { describe, expect, it } from "vitest";
import { jornadaPodeSalvar, lerDocumentos, valorSugerido } from "./jornadaNegocio";
import { contratoAtrasado, contratoChave } from "../../supabase/functions/stalled-deals-notify/contratoRegra";

describe("jornada do negócio", () => {
  it("sugere o valor da proposta e preserva VGV final existente", () => {
    expect(valorSugerido({ proposta_valor: 298000, vgv_estimado: 250000 })).toBe(298000);
    expect(valorSugerido({ vgv_final: 300000, proposta_valor: 298000 })).toBe(300000);
  });
  it("exige unidade e valor para proposta, sem tornar documentos obrigatórios", () => {
    expect(jornadaPodeSalvar("proposta", "connect-jw", "321", 298000)).toBe(true);
    expect(jornadaPodeSalvar("proposta", "connect-jw", "", 298000)).toBe(false);
    expect(jornadaPodeSalvar("proposta", "connect-jw", "321", 0)).toBe(false);
    expect(jornadaPodeSalvar("documentacao", "connect-jw", "", 0)).toBe(true);
    expect(lerDocumentos({ identidade: true })).toEqual({ identidade: true, renda: false, residencia: false });
  });
  it("avisa somente após mais de 7 dias, não exatamente aos 7", () => {
    const c = { status: "gerado", desde: "2026-10-15T12:00:00-03:00", etapa_id: "contrato" };
    const limite = Date.parse("2026-10-22T12:00:00-03:00");
    expect(contratoAtrasado(c, "contrato", limite)).toBe(false);
    expect(contratoAtrasado(c, "contrato", limite + 1)).toBe(true);
  });
  it("avisa apenas gerado e em leitura na etapa atual; sem data não inventa prazo", () => {
    const c = { status: "gerado", desde: "2026-10-01T12:00:00-03:00", etapa_id: "contrato" };
    const now = Date.parse("2026-10-22T12:00:00-03:00");
    expect(contratoAtrasado(c, "contrato", now)).toBe(true);
    expect(contratoAtrasado({ ...c, status: "em_leitura" }, "contrato", now)).toBe(true);
    expect(contratoAtrasado({ ...c, status: "em_confeccao" }, "contrato", now)).toBe(false);
    expect(contratoAtrasado(c, "proposta", now)).toBe(false);
    expect(contratoAtrasado(null, "contrato", now)).toBe(false);
  });
  it("deduplica a mesma situação e reinicia quando a situação muda", () => {
    const c = { status: "gerado", desde: "2026-10-01T12:00:00-03:00", etapa_id: "contrato" };
    expect(contratoChave("cliente", "gerente", c)).toBe(contratoChave("cliente", "gerente", { ...c }));
    expect(contratoChave("cliente", "gerente", { ...c, status: "em_leitura", desde: "2026-10-22T12:00:00-03:00" })).not.toBe(contratoChave("cliente", "gerente", c));
    expect(contratoAtrasado({ ...c, desde: "2026-10-22T12:00:00-03:00" }, "contrato", Date.parse("2026-10-22T15:00:00-03:00"))).toBe(false);
  });
});