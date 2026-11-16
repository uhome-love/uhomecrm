import { describe, it, expect } from "vitest";
import { linhaFora, foraDaRoleta, aptosAgora, evolucaoSemana } from "./performanceRoletaPresentation";
import type { CorretorPerf } from "@/hooks/usePerformanceRoleta";

const mk = (o: Partial<CorretorPerf> & { cod?: string }): CorretorPerf => ({
  user_id: o.nome ?? "x", nome: o.nome ?? "x", equipe: "E", gerente_id: null,
  crm: { pct: 90, em_dia: 0, ambar: 0, vermelho: 0, a_atualizar: 0 },
  motivo: { bloqueado: !!o.cod && o.cod !== "ok", codigo: o.cod ?? "ok", texto: "", titulo: "" },
  visitas_semana_passada: 0, visitas_semana_atual: 0, visitas_marcadas_semana: 0, visitas_dia: [], ...o,
});

describe("performance da roleta", () => {
  it("perto de voltar quando realizadas + marcadas chegam a 2", () => {
    expect(linhaFora(mk({ cod: "visitas_semana", visitas_semana_atual: 1, visitas_marcadas_semana: 1 })).selo).toBe("perto");
    expect(linhaFora(mk({ cod: "visitas_semana", visitas_semana_atual: 1, visitas_marcadas_semana: 0 })).selo).toBe("sem_agenda");
  });
  it("falta de CRM mostra a meta de 80%", () => {
    expect(linhaFora(mk({ cod: "crm", crm: { pct: 72, em_dia: 0, ambar: 0, vermelho: 0, a_atualizar: 6 } })).falta).toBe("CRM 72% → 80%");
  });
  it("ordena quem está mais perto primeiro", () => {
    const r = foraDaRoleta([mk({ nome: "A", cod: "crm" }), mk({ nome: "B", cod: "visitas_semana", visitas_semana_atual: 1, visitas_marcadas_semana: 1 })]);
    expect(r[0].c.nome).toBe("B");
  });
  it("voltou hoje quando completou a 2ª visita hoje", () => {
    expect(aptosAgora([mk({ visitas_semana_atual: 2, visitas_dia: [0, 1, 2] })])[0].voltouHoje).toBe(true);
    expect(aptosAgora([mk({ visitas_semana_atual: 2, visitas_dia: [2, 2] })])[0].voltouHoje).toBe(false);
  });
  it("evolução conta apto por dia e prevê com marcadas", () => {
    const e = evolucaoSemana([mk({ cod: "visitas_semana", visitas_semana_atual: 1, visitas_marcadas_semana: 1, visitas_dia: [0, 1] })]);
    expect(e[1]).toMatchObject({ valor: 0, previsao: false });
    expect(e[2]).toMatchObject({ valor: 1, previsao: true });
  });
});

import { linhasEvolucao, faltamParaTodos } from "./performanceRoletaPresentation";
describe("evolução por corretor", () => {
  it("fora por visitas sem agenda pede marcar agenda", () => {
    const [l] = linhasEvolucao([mk({ cod: "visitas_semana", visitas_semana_atual: 0 })]);
    expect(l.falta).toBe("2 visitas"); expect(l.faltaDetalhe).toBe("marcar agenda");
  });
  it("apto pela semana passada mostra o que falta para manter", () => {
    const [l] = linhasEvolucao([mk({ visitas_semana_passada: 2, visitas_semana_atual: 1 })]);
    expect(l.falta).toBe("manter: 1 visita");
  });
  it("soma visitas faltantes e CRM pendente", () => {
    const t = faltamParaTodos(linhasEvolucao([mk({ nome: "a", cod: "visitas_semana", visitas_semana_atual: 1 }), mk({ nome: "b", cod: "crm" })]));
    expect(t).toEqual({ visitas: 1, crm: 1 });
  });
  it("fora vem antes de apto", () => {
    const r = linhasEvolucao([mk({ nome: "A" }), mk({ nome: "Z", cod: "crm" })]);
    expect(r[0].c.nome).toBe("Z");
  });
});
