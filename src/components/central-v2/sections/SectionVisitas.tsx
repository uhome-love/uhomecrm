import { MapPin } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiRow, type KpiItem } from "@/components/central-v2/shared/KpiRow";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { safeGet } from "@/components/central-v2/shared/safeGet";

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

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <MapPin className="h-5 w-5 text-primary" strokeWidth={1.75} />
        <h2 className="font-central-display text-xl text-foreground">Visitas</h2>
      </div>

      {query.error ? (
        <SectionError query={query} label="Visitas" />
      ) : (
        <>
          <KpiRow
            loading={query.isLoading && !data}
            items={data ? buildKpis(data) : undefined}
          />
          <MiniTable<EmpRow>
            title="Top empreendimentos"
            loading={query.isLoading && !data}
            rows={safeGet<EmpRow[]>(data ?? {}, "extras.por_empreendimento", "Visitas por_empreendimento") ?? []}
            columns={columns}
          />
        </>
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>): KpiItem[] {
  const criadas = safeGet<number>(data, "visitas.criadas", "Visitas criadas");
  const realizadas = safeGet<number>(data, "visitas.realizadas", "Visitas realizadas");
  const noShow = safeGet<number>(data, "visitas.no_show", "Visitas no_show");
  const taxa = safeGet<number>(data, "visitas.taxa_comparecimento_pct", "Visitas taxa_comparecimento_pct");

  return [
    { label: "Criadas", value: fmtInt(criadas) },
    { label: "Realizadas", value: fmtInt(realizadas) },
    { label: "No Show", value: fmtInt(noShow) },
    { label: "Taxa Comparecimento", value: fmtPct(taxa) },
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
  },
];
