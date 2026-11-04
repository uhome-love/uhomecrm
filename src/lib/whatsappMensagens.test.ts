import { describe, expect, it } from "vitest";
import { etapaWhatsApp, gerarMensagensWhatsApp, limparNomeEmpreendimento, selecionarFichaProduto } from "./whatsappMensagens";

const base = { nome: "Andrio Gaspareto", corretorNome: "Pedro Jorge", empreendimento: "Essence Canoas - Natal" };

describe("Regras de mensagens WhatsApp por etapa e produto", () => {
  it.each(["novo_lead", "sem_contato", "qualificacao", "aquecimento", "visita", "pos_visita", "documentacao", "proposta", "contrato_gerado"])("%s oferece três sugestões próprias", stageTipo => {
    const messages = gerarMensagensWhatsApp({ ...base, stageTipo });
    expect(messages).toHaveLength(3);
    expect(new Set(messages.map(m => m.id)).size).toBe(3);
    if (stageTipo !== "novo_lead" && stageTipo !== "sem_contato") {
      expect(messages.map(m => m.id)).not.toEqual(["primeiro_contato", "nao_atendeu", "reativacao"]);
    }
  });
  it.each(["venda", "ganho", "descarte", "inativo", "caiu", "etapa_desconhecida"])("%s não oferece sugestão de etapa errada", stageTipo => {
    expect(gerarMensagensWhatsApp({ ...base, stageTipo })).toEqual([]);
  });
  it("pós-visita é reconhecida pelo estado atual da visita", () => {
    expect(etapaWhatsApp("visita", "realizada")).toBe("pos_visita");
    expect(etapaWhatsApp("visita", "marcada")).toBe("visita");
  });
  it("remove apenas sufixos de versão e campanha, mantendo o produto", () => {
    expect(limparNomeEmpreendimento("Essence Canoas - Natal")).toBe("Essence Canoas");
    expect(limparNomeEmpreendimento("Open Arvoredo v1")).toBe("Open Arvoredo");
    expect(limparNomeEmpreendimento("Casa Tua Porto Alegre — Natal 2026")).toBe("Casa Tua Porto Alegre");
    expect(limparNomeEmpreendimento("Residencial Natal")).toBe("Residencial Natal");
  });
  it("prefere o cadastro oficial e não troca produto por correspondência parcial", () => {
    const fichas = [{ nome: "Casa Tua", valor_min: 499000 }, { nome: "Casa Tua Canoas", valor_min: 600000 }];
    expect(selecionarFichaProduto(fichas, "Casa Tua Porto Alegre", ["Casa Tua"])?.valor_min).toBe(499000);
    expect(selecionarFichaProduto(fichas, "Casa Tua Canoas", ["Casa Tua"])?.valor_min).toBe(600000);
    expect(selecionarFichaProduto(fichas, "Outro Casa Tua")).toBeUndefined();
    expect(selecionarFichaProduto(fichas, "Produto indefinido", ["Casa Tua", "Casa Tua Canoas"])).toBeUndefined();
  });
  it("cadastro sem valor válido não cria preço", () => {
    for (const valorMin of [null, undefined, 0, -1, NaN, Infinity]) {
      const bodies = gerarMensagensWhatsApp({ ...base, stageTipo: "aquecimento", produto: { nome: "Essence Canoas", valorMin } }).map(m => m.body).join(" ");
      expect(bodies).not.toContain("R$");
    }
  });
});