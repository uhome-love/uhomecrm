import { describe, expect, it } from "vitest";
import { comprovantePermitido, pendenciasVenda, type VendaConfirmacaoDados } from "./vendaConfirmacao";

const completa: VendaConfirmacaoDados = {
  empreendimentoCanonicoId: "open-bosque", construtora: "Open", unidade: "321",
  vgvFinal: 298000, dataAssinatura: "2026-10-22", intermediacaoId: "intermediacao",
  comprovanteAtoPath: "lead/cliente/ato.pdf",
};
describe("nova venda assinada", () => {
  it("exige empreendimento oficial e sua construtora", () => {
    expect(pendenciasVenda({ ...completa, empreendimentoCanonicoId: null }, "2026-10-22")).toContain("Empreendimento e construtora");
    expect(pendenciasVenda({ ...completa, construtora: "" }, "2026-10-22")).toContain("Empreendimento e construtora");
  });
  it("exige unidade", () => expect(pendenciasVenda({ ...completa, unidade: " " }, "2026-10-22")).toContain("Unidade"));
  it("exige VGV final positivo", () => expect(pendenciasVenda({ ...completa, vgvFinal: 0 }, "2026-10-22")).toContain("VGV final"));
  it("exige a data real de assinatura, sem data futura", () => {
    expect(pendenciasVenda({ ...completa, dataAssinatura: null }, "2026-10-22")).toContain("Data da assinatura");
    expect(pendenciasVenda({ ...completa, dataAssinatura: "2026-10-23" }, "2026-10-22")).toContain("Data da assinatura");
  });
  it("exige intermediação anexada", () => expect(pendenciasVenda({ ...completa, intermediacaoId: null }, "2026-10-22")).toContain("Intermediação"));
  it("exige comprovante do pagamento do ato", () => expect(pendenciasVenda({ ...completa, comprovanteAtoPath: null }, "2026-10-22")).toContain("Comprovante do ato"));
  it("libera uma venda completa", () => expect(pendenciasVenda(completa, "2026-10-22")).toEqual([]));
  it("aceita comprovante PDF ou imagem e recusa arquivo vazio ou acima de 20 MB", () => {
    expect(comprovantePermitido({ type: "application/pdf", size: 20 * 1024 * 1024 })).toBe(true);
    expect(comprovantePermitido({ type: "image/jpeg", size: 120 })).toBe(true);
    expect(comprovantePermitido({ type: "application/pdf", size: 20 * 1024 * 1024 + 1 })).toBe(false);
    expect(comprovantePermitido({ type: "application/pdf", size: 0 })).toBe(false);
    expect(comprovantePermitido({ type: "text/html", size: 120 })).toBe(false);
  });
});