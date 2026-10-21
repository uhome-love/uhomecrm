import { describe, it, expect } from "vitest";
import { pedidoDentroDaJanela } from "./roletaJanelaCred";

describe("janela de credenciamento da Roleta (BRT)", () => {
  it("tarde aceita 12:00 a 13:29", () => {
    expect(pedidoDentroDaJanela("tarde", new Date("2026-10-21T15:00:00Z"))).toBe(true); // 12:00
    expect(pedidoDentroDaJanela("tarde", new Date("2026-10-21T16:29:00Z"))).toBe(true); // 13:29
  });
  it("tarde recusa 13:30 e o caso das 17:00", () => {
    expect(pedidoDentroDaJanela("tarde", new Date("2026-10-21T16:30:00Z"))).toBe(false);
    expect(pedidoDentroDaJanela("tarde", new Date("2026-10-21T20:00:32Z"))).toBe(false);
  });
  it("manhã fecha às 09:30, noturna às 21:30", () => {
    expect(pedidoDentroDaJanela("manha", new Date("2026-10-21T12:30:00Z"))).toBe(false);
    expect(pedidoDentroDaJanela("noturna", new Date("2026-10-21T00:29:00Z"))).toBe(true); // 21:29
    expect(pedidoDentroDaJanela("noturna", new Date("2026-10-21T00:30:00Z"))).toBe(false);
  });
});
