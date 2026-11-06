import { describe, expect, it } from "vitest";
import { BOTOES_RECUPERA, MODELOS_RECUPERA } from "./recupera";

const vars = (t: string) => new Set(t.match(/\{\{\d\}\}/g) ?? []).size;

describe("modelos Lia Recupera aprovados na Meta", () => {
  it("tem os 6 modelos com a quantidade de variáveis aprovada", () => {
    const esperado: Record<string, number> = {
      lia_recupera_a: 2, lia_recupera_b: 2, lia_recupera_c: 2,
      lia_recupera_d: 1, lia_recupera_lembrete: 3, lia_recupera_final: 1,
    };
    expect(MODELOS_RECUPERA.map((m) => m.chave)).toEqual(Object.keys(esperado));
    for (const m of MODELOS_RECUPERA) expect(vars(m.texto)).toBe(esperado[m.chave]);
  });
  it("lembrete já traz 'o {{2}}, com {{3}}'", () => {
    expect(MODELOS_RECUPERA.find((m) => m.chave === "lia_recupera_lembrete")!.texto).toContain("o {{2}}, com {{3}}");
  });
  it("mantém os 3 botões", () => {
    expect([...BOTOES_RECUPERA]).toEqual(["Sim, quero ver", "Outro perfil", "Não quero mais contato"]);
  });
});
