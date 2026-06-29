import { MapPin, CalendarPlus, CheckCircle2, UserX, Percent } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiGrid, type KpiCardData } from "@/components/central-v2/shared/KpiCard";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { SimpleBarChart, type ChartPoint } from "@/components/central-v2/shared/MiniChart";
import { safeGet } from "@/components/central-v2/shared/safeGet";

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildDowSeries(data: Record<string, unknown> | undefined): ChartPoint[] {
  const porDia = safeGet<Record<string, number>>(data ?? {}, "extras.por_dia_semana", "Visitas por_dia_semana");
  if (!porDia || typeof porDia !== "object") return [];
  return DOW_LABELS.map((label, i) => ({ label, value: Number(porDia[String(i)] ?? 0) }));
}

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface EmpRow {
  empreendimento?: string;
  nome?: string;
  criadas?: number;
  realizadas?: number;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export function SectionVisitas({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={MapPin}
        title="Visitas"
        subtitle="Agendamento, comparecimento e desempenho por empreendimento"
      />

      {query.error ? (
        <SectionError query={query} label="Visitas" />
      ) : (
        <>
          <KpiGrid loading={loading} items={data ? buildKpis(data) : undefined} />
          <div className="grid gap-3 lg:grid-cols-2">
            <SimpleBarChart
              title="Visitas por dia da semana"
              loading={loading}
              data={buildDowSeries(data)}
              emptyLabel="Sem visitas no período."
            />
            <MiniTable<EmpRow>
              title="Top empreendimentos"
              loading={loading}
              rows={safeGet<EmpRow[]>(data ?? {}, "extras.por_empreendimento", "Visitas por_empreendimento") ?? []}
              columns={columns}
            />
          </div>
        </>
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>): KpiCardData[] {
  const criadas = safeGet<number>(data, "visitas.criadas", "Visitas criadas");
  const realizadas = safeGet<number>(data, "visitas.realizadas", "Visitas realizadas");
  const noShow = safeGet<number>(data, "visitas.no_show", "Visitas no_show");
  const taxa = safeGet<number>(data, "visitas.taxa_comparecimento_pct", "Visitas taxa_comparecimento_pct");

  return [
    { label: "Criadas", value: fmtInt(criadas), icon: CalendarPlus },
    { label: "Realizadas", value: fmtInt(realizadas), icon: CheckCircle2 },
    { label: "No Show", value: fmtInt(noShow), icon: UserX },
    { label: "Taxa Comparecimento", value: fmtPct(taxa), icon: Percent },
  ];
}

const columns: MiniColumn<EmpRow>[] = [
  {
    key: "empreendimento",
    label: "Empreendimento",
    align: "left",
    render: (r) => r.empreendimento ?? r.nome ?? "—",
  },
  {
    key: "criadas",
    label: "Criadas",
    align: "right",
    render: (r) => fmtInt(r.criadas ?? null),
  },
  {
    key: "realizadas",
    label: "Realizadas",
    align: "right",
    render: (r) => fmtInt(r.realizadas ?? null),
    bar: (r) => r.realizadas ?? 0,
  },
];
