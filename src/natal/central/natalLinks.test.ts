import { describe, expect, it } from "vitest";
import { campanhaEncerrada, formatarPreco, linkWhatsApp } from "./natalLinks";

describe("natalLinks", () => {
  it("formata preço a partir em reais", () => {
    expect(formatarPreco(329000).replace(/\s/g, " ")).toBe("a partir de R$ 329.000");
  });
  it("usa o texto do site quando não há valor", () => {
    expect(formatarPreco(null, "Sob consulta")).toBe("Sob consulta");
  });
  it("monta link do WhatsApp com mensagem e link codificados", () => {
    const l = linkWhatsApp("Olá! Veja & confira", "https://uhome.com.br/c/x");
    expect(l).toBe("https://wa.me/?text=" + encodeURIComponent("Olá! Veja & confira\n\nhttps://uhome.com.br/c/x"));
  });
  it("não repete o link se a mensagem já tiver", () => {
    expect(linkWhatsApp("Veja https://a.com", "https://a.com")).toBe("https://wa.me/?text=" + encodeURIComponent("Veja https://a.com"));
  });
  it("campanha encerra depois de 18/12 em BRT", () => {
    expect(campanhaEncerrada("2026-12-18", new Date("2026-12-19T02:00:00Z"))).toBe(false);
    expect(campanhaEncerrada("2026-12-18", new Date("2026-12-19T03:30:00Z"))).toBe(true);
  });
});
