/**
 * metrics.ts — definição única das métricas do relatório por equipes.
 * Cada métrica é uma coluna selecionável nas tabelas por corretor.
 */
import type { CorretorRow } from "@/hooks/useRelatorioEquipes";

export type MetricKey =
  | "leads_recebidos"
  | "visitas_marcadas"
  | "visitas_realizadas"
  | "pipeline_ativo"
  | "negocios_andamento"
  | "descartes"
  | "estagnados"
  | "vendas_assinadas"
  | "vgv";

export interface MetricDef {
  key: MetricKey;
  label: string;
  short: string;
  /** true = valor monetário (formatado R$). */
  money?: boolean;
  /** Fotografia do momento (snapshot) — não depende do período. */
  snapshot?: boolean;
  descricao: string;
}

export const METRICS: MetricDef[] = [
  { key: "leads_recebidos", label: "Leads recebidos", short: "Leads", descricao: "Leads distribuídos ao corretor no período." },
  { key: "visitas_marcadas", label: "Visitas marcadas", short: "Vis. marc.", descricao: "Visitas agendadas (criadas) no período." },
  { key: "visitas_realizadas", label: "Visitas realizadas", short: "Vis. real.", descricao: "Visitas com status realizada no período." },
  { key: "pipeline_ativo", label: "Pipeline ativo", short: "Pipeline", snapshot: true, descricao: "Leads ativos no funil agora (exclui Descarte, Caiu e Ganho)." },
  { key: "negocios_andamento", label: "Negócios em andamento", short: "Em neg.", snapshot: true, descricao: "Leads na etapa Em Negociação agora." },
  { key: "descartes", label: "Descartes", short: "Descartes", descricao: "Leads movidos para Descarte/Caiu no período." },
  { key: "estagnados", label: "Estagnados", short: "Estag.", snapshot: true, descricao: "Leads marcados como estagnados agora." },
  { key: "vendas_assinadas", label: "Vendas assinadas", short: "Vendas", descricao: "Negócios com contrato assinado no período." },
  { key: "vgv", label: "VGV assinado (R$)", short: "VGV", money: true, descricao: "Valor Geral de Vendas assinado no período." },
];

export const DEFAULT_METRICS: MetricKey[] = METRICS.map((m) => m.key);

export const METRIC_BY_KEY: Record<MetricKey, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m])
) as Record<MetricKey, MetricDef>;

/** Ordem canônica das colunas. */
export function orderMetrics(keys: MetricKey[]): MetricKey[] {
  return METRICS.map((m) => m.key).filter((k) => keys.includes(k));
}

export interface EquipeAgrupada {
  gerente_id: string;
  gerente_nome: string;
  corretores: CorretorRow[];
  totais: Record<MetricKey, number>;
}

const METRIC_KEYS = METRICS.map((m) => m.key);

function zeroTotais(): Record<MetricKey, number> {
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) as Record<MetricKey, number>;
}

export function somaMetricas(rows: CorretorRow[]): Record<MetricKey, number> {
  const acc = zeroTotais();
  for (const r of rows) {
    for (const k of METRIC_KEYS) acc[k] += Number(r[k] ?? 0);
  }
  return acc;
}

/** Agrupa corretores por equipe (gerente), com totais por equipe. */
export function agruparPorEquipe(corretores: CorretorRow[]): EquipeAgrupada[] {
  const map = new Map<string, CorretorRow[]>();
  for (const c of corretores) {
    const arr = map.get(c.gerente_id) ?? [];
    arr.push(c);
    map.set(c.gerente_id, arr);
  }
  const equipes: EquipeAgrupada[] = [];
  for (const [gerente_id, rows] of map) {
    equipes.push({
      gerente_id,
      gerente_nome: rows[0]?.gerente_nome ?? "Equipe",
      corretores: rows,
      totais: somaMetricas(rows),
    });
  }
  equipes.sort((a, b) => a.gerente_nome.localeCompare(b.gerente_nome, "pt-BR"));
  return equipes;
}

/** Destaques da equipe: líder de vendas/VGV, líder de visitas realizadas, líder de leads. */
export function destaquesEquipe(rows: CorretorRow[]) {
  const byMax = (key: MetricKey) =>
    rows.reduce<CorretorRow | null>((best, r) => (!best || r[key] > best[key] ? r : best), null);
  const topVgv = byMax("vgv");
  const topVisitas = byMax("visitas_realizadas");
  const topLeads = byMax("leads_recebidos");
  return {
    vgv: topVgv && topVgv.vgv > 0 ? topVgv : null,
    visitas: topVisitas && topVisitas.visitas_realizadas > 0 ? topVisitas : null,
    leads: topLeads && topLeads.leads_recebidos > 0 ? topLeads : null,
  };
}
