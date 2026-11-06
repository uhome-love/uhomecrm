import { describe, it, expect } from "vitest";
import { aplicarTravaFinanciamento, FRASE_PADRAO_FINANCIAMENTO, RE_AUDIO_SEM_TRANSCRICAO } from "../../supabase/functions/_shared/liaTravaFinanciamento";

const FICHA = "Open Arvoredo: renda de referência cerca de R$ 7 mil. Open Bosque R$ 240 mil.";
const t = (s: string) => aplicarTravaFinanciamento(s, FICHA);

describe("trava de financiamento", () => {
  it("troca prazo inventado pela idade (caso real 62 anos)", () => {
    const r = t("Pelos bancos, a soma da sua idade com o prazo tem um limite (geralmente até 80 anos). Com 62 anos, o prazo costuma ficar em torno de 15 a 18 anos.|||Você procura para morar?");
    expect(r.trocou).toBe(true);
    expect(r.texto.split("|||")[0]).toBe(FRASE_PADRAO_FINANCIAMENTO);
    expect(r.texto).toContain("Você procura para morar?");
  });
  it("aceita 'até 35 anos'", () => expect(t("Os bancos financiam em até 35 anos, depende da idade e da simulação.").trocou).toBe(false));
  it("aceita repetir a idade do cliente sem falar de prazo", () => expect(t("Que bom, Ivone! Com 62 anos você pode usar FGTS também, a simulação mostra tudo.").trocou).toBe(false));
  it("troca parcela inventada", () => expect(t("A parcela fica em torno de R$ 2.300 por mês.").motivo).toBe("parcela"));
  it("aceita a média aprovada de parcela", () => expect(t("A cada R$ 100 mil financiados, uns R$ 1.000 por mês.").trocou).toBe(false));
  it("troca taxa de juros", () => expect(t("A taxa de juros fica em 9,5% ao ano.").motivo).toBe("taxa"));
  it("troca renda fora da ficha", () => expect(t("Precisa de renda de R$ 5 mil.").motivo).toBe("renda"));
  it("aceita renda da ficha", () => expect(t("A renda de referência é cerca de R$ 7 mil.").trocou).toBe(false));
  it("mantém marcador de sinal ao trocar", () => expect(t("Prazo de 20 anos de financiamento. [[sinal:quente]]").texto).toContain("[[sinal:quente]]"));
  it("reconhece áudio sem transcrição", () => {
    expect(RE_AUDIO_SEM_TRANSCRICAO.test("(o cliente enviou audio · id:123)")).toBe(true);
    expect(RE_AUDIO_SEM_TRANSCRICAO.test("🎤 oi Lia")).toBe(false);
  });
});
