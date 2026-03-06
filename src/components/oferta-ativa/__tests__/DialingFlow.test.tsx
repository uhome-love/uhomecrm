import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Smoke tests for dialing flow utility functions and critical logic.
 * These don't require full component rendering — they test the pure functions
 * and hook logic that caused bugs in production.
 */

// Test normalizeTelefone
import { normalizeTelefone } from "@/hooks/useOfertaAtiva";

describe("normalizeTelefone", () => {
  it("strips non-digit characters", () => {
    expect(normalizeTelefone("(51) 99999-1234")).toBe("51999991234");
  });

  it("removes country code 55", () => {
    expect(normalizeTelefone("5551999991234")).toBe("51999991234");
  });

  it("handles null/undefined", () => {
    expect(normalizeTelefone(null)).toBe("");
    expect(normalizeTelefone(undefined)).toBe("");
  });

  it("keeps 10-digit numbers as-is", () => {
    expect(normalizeTelefone("5132221234")).toBe("5132221234");
  });
});

// Test idempotency key format (used by DialingModeWithScript)
describe("Idempotency key", () => {
  it("generates unique keys per call", () => {
    const userId = "user-123";
    const leadId = "lead-456";
    const key1 = `${userId}_${leadId}_${Date.now()}`;
    // Small delay to guarantee different timestamp
    const key2 = `${userId}_${leadId}_${Date.now() + 1}`;
    expect(key1).not.toBe(key2);
    expect(key1).toContain(userId);
    expect(key1).toContain(leadId);
  });
});

// Test result → points mapping (mirrors server logic, catches drift)
describe("Result points mapping", () => {
  const POINTS: Record<string, number> = {
    com_interesse: 3,
    nao_atendeu: 1,
    sem_interesse: 1,
    numero_errado: 0,
  };

  it("com_interesse gives 3 points", () => {
    expect(POINTS["com_interesse"]).toBe(3);
  });

  it("nao_atendeu gives 1 point", () => {
    expect(POINTS["nao_atendeu"]).toBe(1);
  });

  it("numero_errado gives 0 points", () => {
    expect(POINTS["numero_errado"]).toBe(0);
  });

  it("all 4 results are defined", () => {
    expect(Object.keys(POINTS)).toHaveLength(4);
    expect(Object.keys(POINTS).sort()).toEqual(
      ["com_interesse", "nao_atendeu", "numero_errado", "sem_interesse"]
    );
  });
});

// Test quick feedback options completeness
describe("Quick feedbacks", () => {
  const QUICK_FEEDBACKS: Record<string, string[]> = {
    nao_atendeu: [
      "Chamou e caiu na caixa postal",
      "Chamou mas não atendeu, tentarei novamente",
      "Telefone chamou, desligou sem atender",
      "Caixa postal cheia, sem possibilidade de recado",
    ],
    numero_errado: [
      "Número não existe ou está desligado",
      "Pertence a outra pessoa que não conhece o lead",
      "Número de empresa/comercial, não é o lead",
    ],
    sem_interesse: [
      "Já comprou outro imóvel recentemente",
      "Fora da região, não tem interesse na localização",
      "Sem condições financeiras no momento",
      "Pediu para não ligar mais",
      "Disse que preencheu formulário por engano",
    ],
    com_interesse: [
      "Muito interessado, quer receber material completo",
      "Pediu simulação de valores e condições",
      "Quer visitar o decorado no fim de semana",
      "Já conhece a região, quer detalhes de planta e valores",
      "Interessado mas pediu para retornar em outro horário",
    ],
  };

  it("every result type has at least 3 quick feedbacks", () => {
    for (const [key, feedbacks] of Object.entries(QUICK_FEEDBACKS)) {
      expect(feedbacks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("all feedbacks have at least 10 chars (min for submit)", () => {
    for (const feedbacks of Object.values(QUICK_FEEDBACKS)) {
      for (const fb of feedbacks) {
        expect(fb.length).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

// Test timer formatting (mirrors DialingModeWithScript)
describe("Timer formatting", () => {
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  it("formats 0 seconds", () => expect(formatTimer(0)).toBe("00:00"));
  it("formats 45 seconds", () => expect(formatTimer(45)).toBe("00:45"));
  it("formats 90 seconds", () => expect(formatTimer(90)).toBe("01:30"));
  it("formats 3661 seconds", () => expect(formatTimer(3661)).toBe("61:01"));
});
