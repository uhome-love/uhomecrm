import { describe, it, expect } from "vitest";
import { decidirSwipe, resistenciaSwipe, limiteSwipe } from "@/lib/pipelineV2/swipe";
import {
  produtoLimpo,
  nomeCurto,
  saudeTexto,
  telefoneInternacional,
  linhaProduto,
  situacaoTexto,
} from "@/lib/pipelineV2/textos";
import {
  statusTarefa,
  quandoTarefa,
  tituloCurto,
  horaCurta,
  resolverProximaAcao,
  contarAcoes,
  filtrarPorAcao,
  acaoDoLead,
} from "@/lib/pipelineV2/proximaAcao";

// Quarta-feira, 11/11/2026, 12:00 em Brasília (15:00 UTC).
const AGORA = new Date("2026-11-11T15:00:00Z");
const HOJE = "2026-11-11";

describe("produtoLimpo", () => {
  it.each([
    ["Open Bosque - v4", "Open Bosque"],
    ["Open Bosque - Natal", "Open Bosque"],
    ["Casa Tua Canoas | RMKT Quente 60D", "Casa Tua Canoas"],
    ["Casa Tua Canoas v6 - Final", "Casa Tua Canoas"],
    ["Shift - Qualificado v7", "Shift"],
    ["Vivid - Qualificado - v2", "Vivid"],
    ["Casa Tua Porto Alegre — Natal", "Casa Tua Porto Alegre"],
    ["Open Arvoredo v1", "Open Arvoredo"],
    ["Casa Tua Canoas · RMKT Quente 60D", "Casa Tua Canoas"],
    ["Lake Baikal", "Lake Baikal"],
    ["open", "Open"],
    ["", ""],
  ])("%s → %s", (entrada, esperado) => {
    expect(produtoLimpo(entrada)).toBe(esperado);
  });
  it("aceita null", () => expect(produtoLimpo(null)).toBe(""));
});

describe("textos curtos", () => {
  it("nomeCurto", () => {
    expect(nomeCurto("Luiza Clós")).toBe("Luiza C.");
    expect(nomeCurto("Marcos Aurelio Farias")).toBe("Marcos F.");
    expect(nomeCurto("Roni")).toBe("Roni");
    expect(nomeCurto("")).toBe("");
  });
  it("saudeTexto", () => {
    expect(saudeTexto("vermelho", 19, true)).toBe("19d sem atividade");
    expect(saudeTexto("verde", 4, true)).toBe("atividade há 4d");
    expect(saudeTexto("ambar", 0, true)).toBe("atividade hoje");
    expect(saudeTexto("verde", 1, true)).toBe("atividade ontem");
    expect(saudeTexto("verde", null, false)).toBe("sem atividade ainda");
  });
  it("telefoneInternacional", () => {
    expect(telefoneInternacional("(51) 99622-0074")).toBe("5551996220074");
    expect(telefoneInternacional("5551996220074")).toBe("5551996220074");
    expect(telefoneInternacional("123")).toBe("");
  });
  it("situacaoTexto (sem emoji, em minúscula)", () => {
    expect(situacaoTexto({ status_atendimento: "alinhando_visita" }, "qualificacao")).toBe("alinhando visita");
    expect(situacaoTexto({ status_visita: "no_show" }, "visita")).toBe("não veio na visita");
    expect(situacaoTexto({ status_visita: "marcada" }, "visita")).toBe("visita marcada");
    expect(situacaoTexto({ interesse: "alto" }, "pos_visita")).toBe("interesse alto");
    expect(situacaoTexto({ prazo: "30" }, "aquecimento")).toBe("retomar em 30 dias");
    expect(situacaoTexto(null, "qualificacao")).toBe("");
  });
  it("linhaProduto", () => {
    expect(linhaProduto("Open Bosque", "alinhando visita")).toBe("Open Bosque · alinhando visita");
    expect(linhaProduto("Shift", "")).toBe("Shift");
  });
});

describe("statusTarefa e quandoTarefa (BRT)", () => {
  const t = (vence_em: string | null, hora: string | null = null) => ({ tipo: "follow_up", vence_em, hora_vencimento: hora });
  it("atrasada, hoje, futura, sem e terminal", () => {
    expect(statusTarefa(t("2026-10-25", "10:00:00"), "aquecimento", HOJE, "12:00")).toBe("atrasada");
    expect(statusTarefa(t(HOJE, "09:56:00"), "sem_contato", HOJE, "12:00")).toBe("atrasada");
    expect(statusTarefa(t(HOJE, "15:00:00"), "aquecimento", HOJE, "12:00")).toBe("hoje");
    expect(statusTarefa(t(HOJE), "aquecimento", HOJE, "12:00")).toBe("hoje");
    expect(statusTarefa(t("2026-11-13"), "visita", HOJE, "12:00")).toBe("futura");
    expect(statusTarefa(null, "qualificacao", HOJE, "12:00")).toBe("sem");
    expect(statusTarefa(t("2026-10-01"), "venda", HOJE, "12:00")).toBe("terminal");
  });
  it("textos de quando", () => {
    expect(quandoTarefa(t("2026-10-25", "10:00:00"), HOJE, "12:00")).toBe("venceu 25/10 · há 17 dias");
    expect(quandoTarefa(t("2026-11-10"), HOJE, "12:00")).toBe("venceu 10/11 · há 1 dia");
    expect(quandoTarefa(t(HOJE, "15:00:00"), HOJE, "12:00")).toBe("hoje · 15h");
    expect(quandoTarefa(t(HOJE, "09:56:00"), HOJE, "12:00")).toBe("venceu hoje · 9h56");
    expect(quandoTarefa(t("2026-11-12", "10:00:00"), HOJE, "12:00")).toBe("amanhã · 10h");
    expect(quandoTarefa(t("2026-11-13", "10:00:00"), HOJE, "12:00")).toBe("sex 13/11 · 10h");
    expect(quandoTarefa(t("2026-11-30"), HOJE, "12:00")).toBe("30/11");
  });
  it("horaCurta", () => {
    expect(horaCurta("15:00:00")).toBe("15h");
    expect(horaCurta("09:56")).toBe("9h56");
    expect(horaCurta(null)).toBe("");
  });
});

describe("tituloCurto", () => {
  it.each([
    ["Alinhar próximos passos (Pós-Visita) — Leonardo Prado", "Leonardo Prado", "Alinhar próximos passos"],
    ["Tentativa 1: Ligar agora — Gerson Sperotto", "Gerson Sperotto", "Tentativa 1 · ligar agora"],
    ["WhatsApp: Laís Acácio Cavalcante Barriles · 21/09", "Laís Acácio Cavalcante Barriles", "Mandar WhatsApp"],
    ["Confirmar visita — Alvaro (filho cliente)", "Alvaro (filho cliente)", "Confirmar visita"],
    ["Ligar para retomar", "Ana Maria", "Ligar para retomar"],
    ["", "X", "Tarefa"],
  ])("%s", (titulo, nome, esperado) => {
    expect(tituloCurto(titulo, nome)).toBe(esperado);
  });
});

describe("resolverProximaAcao", () => {
  it("tarefa atrasada: vermelho, ⏰ e botão do tipo", () => {
    const a = resolverProximaAcao({
      stageTipo: "aquecimento",
      tarefa: { tipo: "follow_up", titulo: "Alinhar próximos passos (Pós-Visita) — Leonardo Prado", vence_em: "2026-10-25", hora_vencimento: "10:00:00" },
      nomeLead: "Leonardo Prado",
      agora: AGORA,
    });
    expect(a).toEqual({ tom: "atrasada", emoji: "⏰", titulo: "Alinhar próximos passos", quando: "venceu 25/10 · há 17 dias", botao: "whats" });
  });
  it("ligação para hoje: azul e botão Ligar", () => {
    const a = resolverProximaAcao({ stageTipo: "aquecimento", tarefa: { tipo: "ligacao", titulo: "Ligar para retomar", vence_em: HOJE, hora_vencimento: "15:00:00" }, agora: AGORA });
    expect(a.tom).toBe("hoje");
    expect(a.botao).toBe("ligar");
    expect(a.quando).toBe("hoje · 15h");
  });
  it("confirmar visita (visita_auto): verde e botão Confirmar", () => {
    const a = resolverProximaAcao({ stageTipo: "visita", tarefa: { tipo: "follow_up", titulo: "Confirmar visita — Alvaro", subtipo: "confirmar_visita", origem: "visita_auto", vence_em: "2026-11-13", hora_vencimento: "10:00:00" }, agora: AGORA });
    expect(a).toMatchObject({ tom: "visita", titulo: "Confirmar a visita", botao: "confirmar", quando: "sex 13/11 · 10h" });
  });
  it("sem tarefa em Atendimento: tracejado e Definir", () => {
    const a = resolverProximaAcao({ stageTipo: "qualificacao", tarefa: null, agora: AGORA });
    expect(a).toMatchObject({ tom: "sem", titulo: "Sem próxima ação", botao: "definir" });
  });
  it("novo lead: 1º contato, atrasado depois de 1 hora", () => {
    const recente = resolverProximaAcao({ stageTipo: "novo_lead", tarefa: null, chegouEm: "2026-11-11T14:40:00Z", agora: AGORA });
    expect(recente).toMatchObject({ tom: "hoje", botao: "ligar", quando: "chegou há 20 min" });
    const antigo = resolverProximaAcao({ stageTipo: "novo_lead", tarefa: null, chegouEm: "2026-11-11T11:00:00Z", agora: AGORA });
    expect(antigo.tom).toBe("atrasada");
  });
  it("sem contato com cadência: tentativa vira a ação", () => {
    const a = resolverProximaAcao({ stageTipo: "sem_contato", tarefa: null, cadencia: { tentativa: 5, proxima_em: "2026-11-12T15:00:00Z" }, agora: AGORA });
    expect(a).toMatchObject({ emoji: "📲", titulo: "Tentativa 6 de 7", quando: "próxima em 1 dia", tom: "atencao" });
    const vencida = resolverProximaAcao({ stageTipo: "sem_contato", tarefa: null, cadencia: { tentativa: 4, proxima_em: "2026-11-11T14:00:00Z" }, agora: AGORA });
    expect(vencida).toMatchObject({ tom: "atrasada", quando: "era para agora" });
  });
  it("no-show sem tarefa: remarcar", () => {
    const a = resolverProximaAcao({ stageTipo: "visita", tarefa: null, flagStatus: { status_visita: "no_show" }, agora: AGORA });
    expect(a).toMatchObject({ tom: "atencao", titulo: "Remarcar a visita", botao: "whats" });
  });
  it("etapa terminal: sem caixa", () => {
    expect(resolverProximaAcao({ stageTipo: "venda", tarefa: null, agora: AGORA }).tom).toBe("nenhum");
  });
});

describe("contadores dos atalhos", () => {
  const stageTipoById = { a: "novo_lead", b: "sem_contato", c: "qualificacao", d: "aquecimento", e: "venda" };
  const leads = [
    { id: "1", stage_id: "c" }, // sem tarefa → sem
    { id: "2", stage_id: "d" }, // atrasada
    { id: "3", stage_id: "d" }, // hoje
    { id: "4", stage_id: "a" }, // novo sem tarefa → não conta como "sem"
    { id: "5", stage_id: "b" }, // sem contato sem tarefa → não conta
    { id: "6", stage_id: "e" }, // ganho → fora
  ];
  const tarefas = {
    "2": { tipo: "follow_up", vence_em: "2026-11-01", hora_vencimento: null },
    "3": { tipo: "ligacao", vence_em: HOJE, hora_vencimento: "18:00:00" },
  };
  it("conta atrasada, hoje e sem", () => {
    expect(contarAcoes(leads, tarefas, stageTipoById, AGORA)).toEqual({ atrasada: 1, hoje: 1, sem: 1 });
  });
  it("filtra pelo atalho", () => {
    expect(filtrarPorAcao(leads, "atrasada", tarefas, stageTipoById, AGORA).map((l) => l.id)).toEqual(["2"]);
    expect(filtrarPorAcao(leads, "sem", tarefas, stageTipoById, AGORA).map((l) => l.id)).toEqual(["1"]);
    expect(filtrarPorAcao(leads, "todos", tarefas, stageTipoById, AGORA)).toHaveLength(6);
  });
  it("acaoDoLead ignora terminais", () => {
    expect(acaoDoLead("venda", null, HOJE, "12:00")).toBeNull();
  });
});

describe("arrastar para o lado no celular", () => {
  it("arrasto curto não troca", () => {
    expect(decidirSwipe({ dx: -40, dy: 2, largura: 366, ms: 400 })).toBe(0);
  });
  it("arrasto longo para a esquerda vai para a próxima etapa", () => {
    expect(decidirSwipe({ dx: -90, dy: 10, largura: 366, ms: 400 })).toBe(1);
  });
  it("arrasto longo para a direita volta uma etapa", () => {
    expect(decidirSwipe({ dx: 95, dy: -8, largura: 366, ms: 400 })).toBe(-1);
  });
  it("arrasto rápido e curto também troca", () => {
    expect(decidirSwipe({ dx: -45, dy: 4, largura: 366, ms: 60 })).toBe(1);
  });
  it("gesto mais vertical que horizontal é rolagem, não troca", () => {
    expect(decidirSwipe({ dx: -120, dy: 160, largura: 366, ms: 300 })).toBe(0);
  });
  it("limite fica entre 40 e 80px", () => {
    expect(limiteSwipe(366)).toBe(80);
    expect(limiteSwipe(150)).toBe(40);
  });
  it("mola nas pontas", () => {
    expect(resistenciaSwipe(60, false, true)).toBe(20);
    expect(resistenciaSwipe(-60, true, false)).toBe(-20);
    expect(resistenciaSwipe(-60, true, true)).toBe(-60);
  });
});
