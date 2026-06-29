import { LineChart } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { safeGet } from "@/components/central-v2/shared/safeGet";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface CohortRow {
  mes: string;
  leads: number;
  contatados: number;
  com_visita: number;
  convertidos: number;
  pct_contato: number;
  pct_visita: number;
  pct_conversao: number;
}

/** "2026-06" -> "Jun/26" */
function fmtMes(m: string): string {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [y, mm] = m.split("-");
  const idx = Number(mm) - 1;
  return idx >= 0 && idx < 12 ? `${meses[idx]}/${y.slice(2)}` : m;
}

function PctCell({ pct, count }: { pct: number; count: number }) {
  return (
    <span className="tabular-nums">
      {count.toLocaleString("pt-BR")}{" "}
      <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span>
    </span>
  );
}

export function SectionCohort({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;

  const rows = (safeGet<CohortRow[]>(data ?? {}, "cohorts", "Cohort cohorts") ?? []).map((r) => ({
    ...r,
    mesLabel: fmtMes(r.mes),
  }));

  const columns: MiniColumn<(typeof rows)[number]>[] = [
    { key: "mes", label: "Coorte", align: "left", render: (r) => <span className="font-medium">{r.mesLabel}</span> },
    { key: "leads", label: "Leads", align: "right", render: (r) => r.leads.toLocaleString("pt-BR"), bar: (r) => r.leads },
    { key: "contato", label: "Contatados", align: "right", render: (r) => <PctCell pct={r.pct_contato} count={r.contatados} /> },
    { key: "visita", label: "C/ visita", align: "right", render: (r) => <PctCell pct={r.pct_visita} count={r.com_visita} /> },
    { key: "conv", label: "Convertidos", align: "right", render: (r) => <PctCell pct={r.pct_conversao} count={r.convertidos} /> },
  ];

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={LineChart}
        title="Coorte & Retenção"
        subtitle="Evolução das safras de leads por mês de entrada (últimos 6 meses)"
      />

      {query.error ? (
        <SectionError query={query} label="Coorte & Retenção" />
      ) : (
        <MiniTable
          columns={columns}
          rows={rows}
          loading={loading}
          maxRows={6}
          emptyLabel="Sem leads nos últimos meses."
        />
      )}
    </section>
  );
}
