import { Users } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiRow, type KpiItem } from "@/components/central-v2/shared/KpiRow";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { safeGet } from "@/components/central-v2/shared/safeGet";

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

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader />

      {query.error ? (
        <SectionError query={query} label="Pipeline de Leads" />
      ) : (
        <KpiRow
          loading={query.isLoading && !data}
          items={
            data
              ? buildKpis(data)
              : undefined
          }
        />
      )}
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
      <h2 className="font-display text-xl text-foreground">Pipeline de Leads</h2>
    </div>
  );
}

function buildKpis(data: Record<string, unknown>): KpiItem[] {
  const pipelineAtivo = safeGet<number>(data, "extras.pipeline_ativo", "PL pipeline_ativo");
  const recebidos = safeGet<number>(data, "leads.recebidos", "PL leads.recebidos");
  const recebidosPrev = safeGet<number>(data, "leads.recebidos_prev", "PL leads.recebidos_prev");
  const convVisita = safeGet<number>(data, "extras.conversao_lead_visita_pct", "PL conversao_lead_visita_pct");
  const atualizacao48 = safeGet<number>(data, "extras.taxa_atualizacao_48h", "PL taxa_atualizacao_48h");

  return [
    { label: "Pipeline Ativo", value: fmtInt(pipelineAtivo) },
    {
      label: "Leads Recebidos",
      value: fmtInt(recebidos),
      delta: calcDelta(recebidos, recebidosPrev),
    },
    { label: "Conv. Lead → Visita", value: fmtPct(convVisita) },
    { label: "Atualização 48h", value: fmtPct(atualizacao48) },
  ];
}
