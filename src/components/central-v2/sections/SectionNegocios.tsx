import { Briefcase, Activity, FilePlus2, TrendingDown, PenLine } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiGrid, type KpiCardData } from "@/components/central-v2/shared/KpiCard";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
  /** Vem da RPC de Vendas (vendas.count) — não da RPC de Negócios. */
  assinados: number | null;
  assinadosLoading?: boolean;
}

interface FaseRow {
  fase?: string;
  nome?: string;
  qtd?: number;
  ticket_medio?: number;
  dias?: number;
  dias_medio?: number;
  tempo_medio_em_fase_dias?: number;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

function calcDelta(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function SectionNegocios({ query, assinados, assinadosLoading }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={Briefcase}
        title="Pipeline de Negócios"
        subtitle="Negócios ativos, criação, perdas e distribuição por fase"
      />

      {query.error ? (
        <SectionError query={query} label="Pipeline de Negócios" />
      ) : (
        <>
          <KpiGrid
            loading={loading || assinadosLoading}
            items={data ? buildKpis(data, assinados) : undefined}
          />
          <MiniTable<FaseRow>
            title="Por fase"
            loading={loading}
            rows={safeGet<FaseRow[]>(data ?? {}, "extras.por_fase", "Negocios por_fase") ?? []}
            columns={columns}
          />
        </>
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>, assinados: number | null): KpiCardData[] {
  const ativos = safeGet<number>(data, "negocios.ativos", "Negocios ativos");
  const criados = safeGet<number>(data, "negocios.criados", "Negocios criados");
  const criadosPrev = safeGet<number>(data, "negocios.criados_prev", "Negocios criados_prev");
  const cairam = safeGet<number>(data, "negocios.caidos", "Negocios caidos");

  return [
    { label: "Ativos", value: fmtInt(ativos), icon: Activity },
    {
      label: "Criados",
      value: fmtInt(criados),
      icon: FilePlus2,
      delta: calcDelta(criados, criadosPrev),
    },
    { label: "Caíram", value: fmtInt(cairam), icon: TrendingDown, invertDelta: true },
    { label: "Assinados", value: fmtInt(assinados), icon: PenLine },
  ];
}

const columns: MiniColumn<FaseRow>[] = [
  {
    key: "fase",
    label: "Fase",
    align: "left",
    render: (r) => r.fase ?? r.nome ?? "—",
  },
  {
    key: "qtd",
    label: "Qtd",
    align: "right",
    render: (r) => fmtInt(r.qtd ?? null),
    bar: (r) => r.qtd ?? 0,
  },
  {
    key: "ticket",
    label: "Ticket médio",
    align: "right",
    render: (r) => (r.ticket_medio != null ? fmtMoney(r.ticket_medio, "short") : "—"),
  },
  {
    key: "dias",
    label: "Dias",
    align: "right",
    render: (r) => fmtInt(r.tempo_medio_em_fase_dias ?? r.dias ?? r.dias_medio ?? null),
  },
];
