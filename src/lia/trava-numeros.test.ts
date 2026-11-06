import { describe, it, expect } from "vitest";
import { numerosDe, numerosFora, permitidos, substituirBolhas, FRASE_ENTRADA, FRASE_GENERICA, PERGUNTA_DIRECIONAMENTO } from "../../supabase/functions/_shared/liaTravaNumeros";

const FICHA = "Open Bosque: 2 dorm R$ 269 mil, com vaga R$ 292 mil. Entrada padrão de 10%. Entrega nov/2028. Golden Lake 127 m² a 186 m², R$ 2,48 mi. Skyglass R$ 369 mil.";
const ok = (extra: string[] = []) => permitidos([FICHA, ...extra]);

describe("trava de números", () => {
  it("formatos equivalentes", () => {
    expect(numerosDe("R$ 240 mil")).toEqual([240000]);
    expect(numerosDe("240.000")).toEqual([240000]);
    expect(numerosDe("R$ 2,48 milhões")).toEqual([2480000]);
    expect(numerosDe("46,70 m²")).toEqual([46.7]);
  });
  it("aceita números da ficha (369 mil, 2028, 127 a 186 m², 10%)", () => {
    expect(numerosFora("A partir de R$ 369.000, entrega em 2028, de 127 a 186 m², entrada de 10%.", ok())).toEqual([]);
  });
  it("bloqueia 24 vezes inventado", () => expect(numerosFora("Dá em torno de 24 vezes.", ok())).toEqual([24]));
  it("aceita número dito pelo cliente", () => {
    expect(numerosFora("Com 62 anos e renda de R$ 5.000, a simulação mostra.", ok(["tenho 62 anos, minha renda é 5 mil"]))).toEqual([]);
  });
  it("entrada vira frase da entrada e ganha pergunta", () => {
    const r = substituirBolhas("A entrada dá em 24 vezes.", ok());
    expect(r.split("|||")).toEqual([FRASE_ENTRADA, PERGUNTA_DIRECIONAMENTO]);
  });
  it("outro assunto vira frase genérica e mantém a pergunta existente", () => {
    const r = substituirBolhas("O condomínio fica R$ 850.|||Quer conhecer no sábado?", ok());
    expect(r.split("|||")).toEqual([FRASE_GENERICA, "Quer conhecer no sábado?"]);
  });
  it("horário e vezes não aproveitam número de outro assunto", () => {
    const k = permitidos([FICHA, "renda de R$ 9 mil, 24 m²"]);
    expect(numerosFora("Abre às 9h aos sábados.", k)).toEqual([9]);
    expect(numerosFora("Parcela em 24 vezes.", k)).toEqual([24]);
  });
  it("ignora dígitos de marcadores", () => expect(numerosFora("[[midia:natal_ate_300]]", ok())).toEqual([]));
});
