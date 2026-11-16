/** Seletores puros da aba Performance da Roleta. Só apresentação — a regra viva é roleta_apto_janela. */
import type { CorretorPerf } from "@/hooks/usePerformanceRoleta";
import { MOTIVO_GRUPO } from "@/hooks/usePerformanceRoleta";

export const META_VISITAS = 2;
export const META_CRM = 80;

export type Selo = "perto" | "crm" | "sem_agenda" | "descartes" | "outro";
export interface ForaRow { c: CorretorPerf; selo: Selo; falta: string; detalhe: string; distancia: number }
export interface AptoRow { c: CorretorPerf; porque: string; voltouHoje: boolean; voltouNaSemana: boolean }

const n = (x: unknown) => Number(x ?? 0);
const crmOk = (c: CorretorPerf) => !c.motivo?.bloqueado || MOTIVO_GRUPO(c.motivo.codigo) === "visitas";
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".", ","));

export function linhaFora(c: CorretorPerf): ForaRow {
  const g = MOTIVO_GRUPO(c.motivo?.codigo ?? "");
  const atual = n(c.visitas_semana_atual), marc = n(c.visitas_marcadas_semana);
  if (g === "visitas") {
    const falta = Math.max(0, META_VISITAS - atual);
    const perto = atual + marc >= META_VISITAS;
    return { c, selo: perto ? "perto" : "sem_agenda", falta: `${fmt(falta)} visita${falta > 1 ? "s" : ""}`,
      detalhe: `${fmt(atual)} realizada${atual === 1 ? "" : "s"} · ${marc ? `${marc} marcada${marc > 1 ? "s" : ""}` : "nada marcado"}`,
      distancia: perto ? falta : 10 + falta - marc };
  }
  if (g === "crm") {
    const pct = c.crm?.pct ?? 0;
    return { c, selo: "crm", falta: `CRM ${pct}% → ${META_CRM}%`, detalhe: `atualizar ${c.crm?.a_atualizar ?? 0} clientes`, distancia: 20 + (META_CRM - pct) / 10 };
  }
  return { c, selo: g === "descartes" ? "descartes" : "outro", falta: c.motivo?.titulo ?? "Bloqueado", detalhe: c.motivo?.texto ?? "", distancia: 40 };
}

export const foraDaRoleta = (l: CorretorPerf[]) =>
  l.filter((c) => c.motivo?.bloqueado).map(linhaFora).sort((a, b) => a.distancia - b.distancia || a.c.nome.localeCompare(b.c.nome));

export function aptosAgora(l: CorretorPerf[]): AptoRow[] {
  return l.filter((c) => !c.motivo?.bloqueado).map((c) => {
    const ant = n(c.visitas_semana_passada), dia = (c.visitas_dia ?? []).map(n);
    const viaSemana = ant < META_VISITAS && n(c.visitas_semana_atual) >= META_VISITAS;
    const voltouHoje = viaSemana && dia.length >= 2 ? dia[dia.length - 2] < META_VISITAS : viaSemana && dia.length === 1;
    const crm = c.crm?.pct != null ? ` · CRM ${c.crm.pct}%` : "";
    const porque = viaSemana ? `${fmt(n(c.visitas_semana_atual))} visitas nesta semana${crm}` : `${fmt(ant)} visitas sem. passada${crm}`;
    return { c, porque, voltouHoje, voltouNaSemana: viaSemana };
  }).sort((a, b) => Number(b.voltouHoje) - Number(a.voltouHoje) || a.c.nome.localeCompare(b.c.nome));
}

/** Aptos por dia de seg a dom: dias passados reais (CRM atual), futuros = previsão com visitas marcadas. */
export function evolucaoSemana(l: CorretorPerf[]) {
  const dias = Math.max(1, ...l.map((c) => (c.visitas_dia ?? []).length));
  return Array.from({ length: 7 }, (_, i) => {
    const previsao = i >= dias;
    const valor = l.filter((c) => {
      if (!crmOk(c)) return false;
      if (n(c.visitas_semana_passada) >= META_VISITAS) return true;
      const d = (c.visitas_dia ?? []).map(n);
      return previsao ? n(c.visitas_semana_atual) + n(c.visitas_marcadas_semana) >= META_VISITAS : (d[i] ?? 0) >= META_VISITAS;
    }).length;
    return { i, valor, previsao, hoje: i === dias - 1 };
  });
}

export function kpis(l: CorretorPerf[]) {
  const fora = foraDaRoleta(l), aptos = aptosAgora(l);
  const g = (s: string) => l.filter((c) => c.motivo?.bloqueado && MOTIVO_GRUPO(c.motivo.codigo) === s).length;
  return {
    total: l.length, aptos: aptos.length, voltaram: aptos.filter((a) => a.voltouNaSemana).length,
    fora: fora.length, foraVis: g("visitas"), foraCrm: g("crm"), foraOutros: g("descartes") + g("outro"),
    perto: fora.filter((f) => f.selo === "perto").length,
    realizadas: l.reduce((a, c) => a + n(c.visitas_semana_atual), 0),
    marcadas: l.reduce((a, c) => a + n(c.visitas_marcadas_semana), 0),
  };
}
