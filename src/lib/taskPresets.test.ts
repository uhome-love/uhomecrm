/**
 * Regression tests para o Motor de Próxima Ação — presets manuais.
 *
 * Como WhatsAppFocusFlow e CallFocusOverlay consomem exatamente
 * `getPresetsForStage` + `applyPresetToTarefa` + `preset.syncFlagKey/Value`,
 * testar o módulo puro cobre as duas rotas:
 *  - chip visibility por etapa
 *  - auto-preenchimento (tipo, vence_em, hora, obs)
 *  - contrato de sync de flag_status
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { addDays, format } from "date-fns";
import {
  getPresetsForStage,
  applyPresetToTarefa,
  PRESET_OUTRO_ID,
  PRESET_OUTRO,
} from "./taskPresets";

const FIXED_NOW = new Date("2026-07-21T12:00:00-03:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getPresetsForStage — chip visibility", () => {
  it("retorna vazio para etapas sem presets (sem_contato, visita, contrato, etc.)", () => {
    expect(getPresetsForStage(null)).toEqual([]);
    expect(getPresetsForStage(undefined)).toEqual([]);
    expect(getPresetsForStage("sem_contato")).toEqual([]);
    expect(getPresetsForStage("visita")).toEqual([]);
    expect(getPresetsForStage("contrato")).toEqual([]);
    expect(getPresetsForStage("novo_lead")).toEqual([]);
  });

  it("qualificação: 5 presets canônicos + Outro no fim", () => {
    const list = getPresetsForStage("qualificacao");
    expect(list.map((p) => p.id)).toEqual([
      "alinhar_perfil",
      "buscar_imoveis",
      "enviar_imoveis",
      "follow_up",
      "alinhar_visita",
      PRESET_OUTRO_ID,
    ]);
  });

  it("aquecimento: 3 prazos (30/60/90) + Outro", () => {
    const list = getPresetsForStage("aquecimento");
    expect(list.map((p) => p.id)).toEqual([
      "retomar_30",
      "retomar_60",
      "retomar_90",
      PRESET_OUTRO_ID,
    ]);
  });

  it("negociação: 3 presets + Outro", () => {
    const list = getPresetsForStage("negociacao");
    expect(list.map((p) => p.id)).toEqual([
      "enviar_proposta",
      "cobrar_retorno",
      "acompanhar_aprovacao",
      PRESET_OUTRO_ID,
    ]);
  });

  it("Outro está sempre no último índice quando presets existem", () => {
    for (const stage of ["qualificacao", "aquecimento", "negociacao"]) {
      const list = getPresetsForStage(stage);
      expect(list[list.length - 1].id).toBe(PRESET_OUTRO_ID);
    }
  });
});

describe("applyPresetToTarefa — auto-preenchimento", () => {
  it("preenche tipo, hora e obs vindos do preset", () => {
    const preset = getPresetsForStage("qualificacao").find((p) => p.id === "alinhar_perfil")!;
    const payload = applyPresetToTarefa(preset);
    expect(payload.tipo).toBe("ligacao");
    expect(payload.hora_vencimento).toBe("10:00");
    expect(payload.obs).toBe("Ligar para alinhar perfil (tipologia, faixa, região).");
  });

  it("calcula vence_em corretamente com base em prazoDias (BRT)", () => {
    const cases: Array<{ id: string; stage: string; dias: number }> = [
      { id: "alinhar_perfil", stage: "qualificacao", dias: 1 },
      { id: "buscar_imoveis", stage: "qualificacao", dias: 2 },
      { id: "retomar_30", stage: "aquecimento", dias: 30 },
      { id: "retomar_60", stage: "aquecimento", dias: 60 },
      { id: "retomar_90", stage: "aquecimento", dias: 90 },
      { id: "acompanhar_aprovacao", stage: "negociacao", dias: 3 },
    ];
    for (const c of cases) {
      const preset = getPresetsForStage(c.stage).find((p) => p.id === c.id)!;
      const payload = applyPresetToTarefa(preset);
      const expected = format(addDays(FIXED_NOW, c.dias), "yyyy-MM-dd");
      expect(payload.vence_em, `${c.id}`).toBe(expected);
    }
  });

  it("Outro devolve tipo follow_up com obs vazia (modo livre)", () => {
    const payload = applyPresetToTarefa(PRESET_OUTRO);
    expect(payload.tipo).toBe("follow_up");
    expect(payload.obs).toBe("");
  });
});

describe("Sync de flag_status", () => {
  it("qualificação mapeia todos os presets para status_atendimento canônicos", () => {
    const expected: Record<string, string> = {
      alinhar_perfil: "alinhamento_perfil",
      buscar_imoveis: "busca",
      enviar_imoveis: "envio_opcoes",
      follow_up: "follow_up",
      alinhar_visita: "alinhando_visita",
    };
    const list = getPresetsForStage("qualificacao").filter((p) => p.id !== PRESET_OUTRO_ID);
    for (const p of list) {
      expect(p.syncFlagKey).toBe("status_atendimento");
      expect(p.syncFlagValue).toBe(expected[p.id]);
    }
  });

  it("aquecimento mapeia prazo 30/60/90", () => {
    const list = getPresetsForStage("aquecimento").filter((p) => p.id !== PRESET_OUTRO_ID);
    for (const p of list) {
      expect(p.syncFlagKey).toBe("prazo");
      expect(["30", "60", "90"]).toContain(p.syncFlagValue!);
    }
  });

  it("negociação: enviar_proposta e acompanhar_aprovacao têm sync, cobrar_retorno é neutro", () => {
    const list = getPresetsForStage("negociacao");
    const byId = Object.fromEntries(list.map((p) => [p.id, p]));
    expect(byId.enviar_proposta.syncFlagKey).toBe("status_negociacao");
    expect(byId.enviar_proposta.syncFlagValue).toBe("proposta_enviada");
    expect(byId.acompanhar_aprovacao.syncFlagKey).toBe("status_negociacao");
    expect(byId.acompanhar_aprovacao.syncFlagValue).toBe("aprovacao_bancaria");
    expect(byId.cobrar_retorno.syncFlagKey).toBeUndefined();
    expect(byId.cobrar_retorno.syncFlagValue).toBeUndefined();
  });

  it("Outro nunca aplica sync (modo livre)", () => {
    expect(PRESET_OUTRO.syncFlagKey).toBeUndefined();
    expect(PRESET_OUTRO.syncFlagValue).toBeUndefined();
  });

  it("Simula o patch aplicado por WhatsAppFocusFlow / CallFocusOverlay", () => {
    const preset = getPresetsForStage("qualificacao").find((p) => p.id === "enviar_imoveis")!;
    const currentFlags = { some_other: "x" } as Record<string, unknown>;
    const patch =
      preset.syncFlagKey && preset.syncFlagValue
        ? { ...currentFlags, [preset.syncFlagKey]: preset.syncFlagValue }
        : currentFlags;
    expect(patch).toEqual({ some_other: "x", status_atendimento: "envio_opcoes" });
  });
});
