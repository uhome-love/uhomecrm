// Guarda do prompt da Lia: quebra em `npm test` mesmo sem build.
// Editar o .txt sem regerar o .b64.ts deixa de ser silêncio e vira teste vermelho.
import { describe, expect, it } from "vitest";
import { verificar } from "../../scripts/lia-prompt.mjs";

describe("prompt da Lia", () => {
  it("mantém .txt, .b64.ts e o hash registrado idênticos", () => {
    expect(verificar()).toEqual([]);
  });
});
