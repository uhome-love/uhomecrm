import { Layers3, Radio } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface SegRow {
  segmento?: string;
  leads?: number;
  visitas?: number;
  vendas?: number;
  vgv?: number;
}

interface OrigemRow {
  origem?: string;
  leads?: number;
  com_visita?: number;
  conv_pct?: number;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export function SectionOrigemSegmento({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;

  const segmentos = safeGet<SegRow[]>(data ?? {}, "extras.por_segmento", "OS por_segmento") ?? [];
  const origens = safeGet<OrigemRow[]>(data ?? {}, "extras.por_origem", "OS por_origem") ?? [];

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={Layers3}
        title="Origem & Segmento"
        subtitle="De onde vêm os leads e onde está o VGV — quebra por segmento e por canal"
      />

      {query.error ? (
        <SectionError query={query} label="Origem & Segmento" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <MiniTable<SegRow>
            title="Desempenho por segmento"
            loading={loading}
            rows={segmentos}
            columns={segColumns}
            maxRows={6}
            emptyLabel="Sem leads no período."
          />
          <MiniTable<OrigemRow>
            title="Funil por canal de origem"
            loading={loading}
            rows={origens}
            columns={origemColumns}
            maxRows={8}
            emptyLabel="Sem leads no período."
          />
        </div>
      )}
    </section>
  );
}

const segColumns: MiniColumn<SegRow>[] = [
  {
    key: "segmento",
    label: "Segmento",
    align: "left",
    render: (r) => r.segmento ?? "—",
  },
  {
    key: "leads",
    label: "Leads",
    align: "right",
    render: (r) => fmtInt(r.leads),
    bar: (r) => r.leads ?? 0,
  },
  {
    key: "visitas",
    label: "Visitas",
    align: "right",
    render: (r) => fmtInt(r.visitas),
  },
  {
    key: "vendas",
    label: "Vendas",
    align: "right",
    render: (r) => fmtInt(r.vendas),
  },
  {
    key: "vgv",
    label: "VGV",
    align: "right",
    render: (r) => (r.vgv ? fmtMoney(r.vgv, "short") : "—"),
    bar: (r) => r.vgv ?? 0,
  },
];

const origemColumns: MiniColumn<OrigemRow>[] = [
  {
    key: "origem",
    label: "Canal",
    align: "left",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <Radio className="h-3.5 w-3.5 text-muted-foreground" />
        {r.origem ?? "—"}
      </span>
    ),
  },
  {
    key: "leads",
    label: "Leads",
    align: "right",
    render: (r) => fmtInt(r.leads),
    bar: (r) => r.leads ?? 0,
  },
  {
    key: "com_visita",
    label: "C/ visita",
    align: "right",
    render: (r) => fmtInt(r.com_visita),
  },
  {
    key: "conv_pct",
    label: "Conv.",
    align: "right",
    render: (r) => fmtPct(r.conv_pct),
  },
];
