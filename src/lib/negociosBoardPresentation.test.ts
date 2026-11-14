import { describe, expect, it } from "vitest";
import type { NegocioCard } from "@/hooks/useNegociosBoard";
import { filtrarNegociosAtalho, recortarNegocios, recortarPosVisita, resumoNegocios } from "./negociosBoardPresentation";

const card = (id: string, values: Partial<NegocioCard> = {}): NegocioCard => ({ id, pipelineLeadId: id, cliente: id, empreendimento: "Open Bosque", corretor: "Roni", corretorId: "r", corretorUserId: "r", corretorAvatar: null, fase: "em_negociacao", sub: null, passo: "documentacao", detalhe: "", vgv: 620000, vgvFinal: null, dias: 2, tone: "", saude: "verde", ceo: false, dataAssinatura: null, meu: true, ...values });
describe("resumo e atalhos de Negócios", () => {
  it("soma somente Documentação, Proposta e Contrato; Ganho não é andamento", () => {
    expect(resumoNegocios([card("docs"), card("proposta", { passo: "proposta", vgv: 735000 }), card("contrato", { passo: "contrato", vgv: 415000 }), card("ganho", { passo: "ganho", fase: "ganho", vgv: 4800000 })])).toEqual({ quantidade: 3, vgv: 1770000, parados: 0, semVgv: 0 });
  });
  it("não duplica contagem nem valor de um mesmo negócio", () => {
    const row = card("mesmo");
    expect(resumoNegocios([row, row])).toEqual({ quantidade: 1, vgv: 620000, parados: 0, semVgv: 0 });
  });
  it("VGV ausente não é inventado; zero informado continua sendo zero", () => {
    const rows = [card("ausente", { vgv: null }), card("zero", { vgv: 0 })];
    expect(resumoNegocios(rows)).toEqual({ quantidade: 2, vgv: 0, parados: 0, semVgv: 1 });
    expect(filtrarNegociosAtalho(rows, "sem_vgv").map(r => r.id)).toEqual(["ausente"]);
  });
  it("parado é mais de 7 dias; exatamente 7 e ação futura em dia não entram", () => {
    const rows = [card("sete", { dias: 7, saude: "ambar" }), card("oito", { dias: 8, saude: "ambar" }), card("futura", { dias: 20, saude: "verde" })];
    expect(resumoNegocios(rows).parados).toBe(1);
    expect(filtrarNegociosAtalho(rows, "parados").map(r => r.id)).toEqual(["oito"]);
  });
  it("resumo base permanece independente do próprio atalho", () => {
    const rows = [card("a"), card("b", { vgv: null })];
    expect(filtrarNegociosAtalho(rows, "sem_vgv")).toHaveLength(1);
    expect(resumoNegocios(rows).quantidade).toBe(2);
    expect(filtrarNegociosAtalho(rows, "todos")).toHaveLength(2);
  });
  it("Meus, gestor, corretor e busca reconciliam resumo com o recorte", () => {
    const rows = [card("meu"), card("outro", { meu: false, corretorUserId: "l", corretor: "Luiza" })];
    const scope = { lens: "equipe" as const, search: "Roni", corretor: "all", gestorIds: ["r"] };
    expect(resumoNegocios(recortarNegocios(rows, scope)).vgv).toBe(620000);
    expect(recortarNegocios(rows, { ...scope, lens: "meus", search: "", gestorIds: null })).toHaveLength(1);
    expect(recortarNegocios(rows, { ...scope, gestorIds: [], search: "" })).toHaveLength(0);
    expect(recortarNegocios(rows, { ...scope, corretor: "l" })).toHaveLength(0);
  });
  it("Pós-Visita fica em coleção separada e nunca alimenta resumo de negócios", () => {
    const pos = { id: "pos", nome: "Cliente", empreendimento: "Open", corretor: "Roni", corretorId: "r", corretorUserId: "r", corretorAvatar: null, saude: "verde" as const, sinal: "interesse" as const, dias: 1, meu: true };
    expect(recortarPosVisita([pos], { lens: "meus", search: "Cliente", corretor: "all" })).toHaveLength(1);
    expect(resumoNegocios([]).quantidade).toBe(0);
  });
});