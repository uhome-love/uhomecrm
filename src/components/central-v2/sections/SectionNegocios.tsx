import { Briefcase } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiRow, type KpiItem } from "@/components/central-v2/shared/KpiRow";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
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
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Briefcase className="h-5 w-5 text-primary" strokeWidth={1.75} />
        <h2 className="font-central-display text-xl text-foreground">Pipeline de Negócios</h2>
      </div>

      {query.error ? (
        <SectionError query={query} label="Pipeline de Negócios" />
      ) : (
        <>
          <KpiRow
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

function buildKpis(data: Record<string, unknown>, assinados: number | null): KpiItem[] {
  const ativos = safeGet<number>(data, "negocios.ativos", "Negocios ativos");
  const criados = safeGet<number>(data, "negocios.criados", "Negocios criados");
  const criadosPrev = safeGet<number>(data, "negocios.criados_prev", "Negocios criados_prev");
  const cairam = safeGet<number>(data, "negocios.caidos", "Negocios caidos");

  return [
    { label: "Ativos", value: fmtInt(ativos) },
    {
      label: "Criados",
      value: fmtInt(criados),
      delta: calcDelta(criados, criadosPrev),
    },
    { label: "Caíram", value: fmtInt(cairam) },
    { label: "Assinados", value: fmtInt(assinados) },
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
    render: (r) => fmtInt(r.dias ?? r.dias_medio ?? null),
  },
];
