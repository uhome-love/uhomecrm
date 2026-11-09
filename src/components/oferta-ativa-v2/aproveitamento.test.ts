import { describe, it, expect } from "vitest";
import { dentroDoPrazo, mensagemAproveitar, HISTORICO_HORAS } from "./aproveitamento";

describe("aproveitamento", () => {
  it("histórico vale só 24 horas", () => {
    expect(HISTORICO_HORAS).toBe(24);
    const agora = Date.parse("2026-11-09T12:00:00Z");
    expect(dentroDoPrazo("2026-11-08T12:30:00Z", agora)).toBe(true);
    expect(dentroDoPrazo("2026-11-08T11:30:00Z", agora)).toBe(false);
  });
  it("cliente com outro corretor mostra o nome", () => {
    expect(mensagemAproveitar({ status: "com_outro", corretor_nome: "Billy J." })).toBe("Este cliente já está com Billy J. no Pipeline.");
  });
  it("fora do prazo manda para o gerente", () => {
    expect(mensagemAproveitar({ status: "fora_prazo" })).toContain("gerente");
  });
});
