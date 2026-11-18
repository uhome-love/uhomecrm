import { describe, expect, it } from "vitest";
import { siteLeadNaBusca, type SiteLeadSemCartao } from "./siteLeadSemCartao";

const row: SiteLeadSemCartao = {
  id: "2ee107a6-df07-40d5-9b7e-3015c312b1c4", nome: "TESTE CENTRAL info",
  telefone: null, email: null, imovel_interesse: "Open Bosque", origem: "site_uhome",
  status: "novo", observacoes: null, created_at: "2026-11-18T00:36:00Z",
  updated_at: "2026-11-18T00:36:00Z", pipeline_lead_id: null, is_teste: false,
};
describe("cadastro do site sem cartão", () => {
  it("inclui o cadastro sem atribuir corretor nem criar cartão", () => {
    expect(siteLeadNaBusca(row)).toMatchObject({ id: row.id, source: "site", corretor_id: null });
  });
  it("exclui cadastro marcado como teste", () => {
    expect(siteLeadNaBusca({ ...row, is_teste: true })).toBeNull();
  });
  it("exclui cadastro arquivado", () => {
    expect(siteLeadNaBusca({ ...row, status: "arquivado" })).toBeNull();
  });
  it("não duplica cadastro com vínculo explícito ao funil", () => {
    expect(siteLeadNaBusca({ ...row, pipeline_lead_id: "922c7a75-75f3-417e-a7f3-59d4baf92960" })).toBeNull();
  });
});