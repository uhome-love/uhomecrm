import { Users, Layers, UserPlus, GitBranch, Clock } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiGrid, type KpiCardData } from "@/components/central-v2/shared/KpiCard";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

function fmtInt(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function calcDelta(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function SectionPipelineLeads({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={Users}
        title="Pipeline"
        subtitle="Entrada, atividade e conversão de leads no funil comercial"
      />

      {query.error ? (
        <SectionError query={query} label="Pipeline" />
      ) : (
        <KpiGrid loading={loading} items={data ? buildKpis(data) : undefined} />
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>): KpiCardData[] {
  const pipelineAtivo = safeGet<number>(data, "extras.pipeline_ativo", "PL pipeline_ativo");
  const recebidos = safeGet<number>(data, "leads.recebidos", "PL leads.recebidos");
  const recebidosPrev = safeGet<number>(data, "leads.recebidos_prev", "PL leads.recebidos_prev");
  const convVisita = safeGet<number>(data, "extras.conversao_lead_visita_pct", "PL conversao_lead_visita_pct");
  const atualizacao48 = safeGet<number>(data, "extras.taxa_atualizacao_48h", "PL taxa_atualizacao_48h");

  return [
    { label: "Pipeline Ativo", value: fmtInt(pipelineAtivo), icon: Layers, hint: "Leads vivos no funil" },
    {
      label: "Leads Recebidos",
      value: fmtInt(recebidos),
      icon: UserPlus,
      delta: calcDelta(recebidos, recebidosPrev),
    },
    { label: "Conv. Lead → Visita", value: fmtPct(convVisita), icon: GitBranch },
    { label: "Atualização 48h", value: fmtPct(atualizacao48), icon: Clock },
  ];
}
