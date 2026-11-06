import { describe, expect, it } from "vitest";
import { classificarResposta, novoContatoWhatsApp, prazoReaviso } from "../../supabase/functions/_shared/liaRecuperaRespostas";

describe("Fase 2: decisões aprovadas", () => {
  it("saída reconhecida pelo payload mesmo sem título", () => expect(classificarResposta("", "lia_recupera_opt_out")).toBe("opt_out"));
  it.each(["Não quero mais contato", "para de mandar", "não quero receber", "me tira da lista"])("pedido global: %s", t => expect(classificarResposta(t)).toBe("opt_out"));
  it("já comprei marca compra, não mero desinteresse", () => expect(classificarResposta("Já comprei com outra imobiliária")).toBe("ja_comprou"));
  it.each(["Ainda não comprei", "Deixa quieto", "Agora não", "Não quero esse apartamento"])("não bloqueia indevidamente: %s", t => expect(classificarResposta(t)).toBe("seguir"));
  it("novo pedido iniciado pelo cliente pode reabrir", () => expect(novoContatoWhatsApp("Quero voltar a procurar um imóvel")).toBe(true));
  it("botão ou resposta ao disparo antigo não reabre", () => { expect(novoContatoWhatsApp("Quero comprar", "wamid.antigo")).toBe(false); expect(novoContatoWhatsApp("Quero comprar", null, "sim")).toBe(false); expect(novoContatoWhatsApp("ok")).toBe(false); });
  it("reaviso após 30 minutos comerciais", () => expect(prazoReaviso(new Date("2026-11-06T18:00:00Z")).toISOString()).toBe("2026-11-06T18:30:00.000Z"));
  it("noite não conta no prazo", () => expect(prazoReaviso(new Date("2026-11-06T22:50:00Z")).toISOString()).toBe("2026-11-07T12:20:00.000Z"));
  it("domingo não conta no prazo", () => expect(prazoReaviso(new Date("2026-11-07T22:50:00Z")).toISOString()).toBe("2026-11-09T12:20:00.000Z"));
});