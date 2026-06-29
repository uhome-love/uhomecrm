import { TrendingUp, Banknote, Receipt, PercentCircle, Coins } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiGrid, type KpiCardData } from "@/components/central-v2/shared/KpiCard";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { TrendAreaChart, type ChartPoint } from "@/components/central-v2/shared/MiniChart";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface EmpRow {
  empreendimento?: string;
  nome?: string;
  count?: number;
  vendas?: number;
  vgv?: number;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

/** extras.por_dia → { "2026-06-01": { count, vgv }, ... } → série ordenada por data. */
function buildVgvSeries(data: Record<string, unknown> | undefined): ChartPoint[] {
  const porDia = safeGet<Record<string, { vgv?: number; count?: number }>>(
    data ?? {},
    "extras.por_dia",
    "Vendas por_dia"
  );
  if (!porDia || typeof porDia !== "object") return [];
  return Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, v]) => {
      const [, m, d] = dia.split("-");
      return { label: m && d ? `${d}/${m}` : dia, value: Number(v?.vgv ?? 0) };
    });
}

export function SectionVendas({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;
  const series = buildVgvSeries(data);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={TrendingUp}
        title="Vendas"
        subtitle="VGV assinado, ticket médio, comissão e evolução diária"
      />

      {query.error ? (
        <SectionError query={query} label="Vendas" />
      ) : (
        <>
          <KpiGrid loading={loading} items={data ? buildKpis(data) : undefined} />
          <TrendAreaChart
            title="VGV assinado por dia"
            loading={loading}
            data={series}
            valueFormatter={(v) => fmtMoney(v, "short")}
            emptyLabel="Sem vendas assinadas no período."
          />
          <MiniTable<EmpRow>
            title="Top empreendimentos"
            loading={loading}
            rows={safeGet<EmpRow[]>(data ?? {}, "extras.por_empreendimento", "Vendas por_empreendimento") ?? []}
            columns={columns}
          />
        </>
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>): KpiCardData[] {
  const vgv = safeGet<number>(data, "vendas.vgv", "Vendas vgv");
  const count = safeGet<number>(data, "vendas.count", "Vendas count");
  const ticket = safeGet<number>(data, "vendas.ticket_medio", "Vendas ticket_medio");
  const comissao = safeGet<number>(data, "extras.comissao_estimada", "Vendas comissao_estimada");
  const deltaPct = safeGet<number>(data, "vendas.delta_pct", "Vendas delta_pct");

  const vgvFmt = vgv != null ? fmtMoney(vgv, "shortWithTooltip") : { display: "—", title: "—" };

  return [
    {
      label: "VGV Total",
      value: vgvFmt.display,
      title: vgvFmt.title,
      delta: deltaPct,
      icon: Banknote,
    },
    { label: "Vendas", value: fmtInt(count), icon: Receipt },
    { label: "Ticket Médio", value: ticket != null ? fmtMoney(ticket, "short") : "—", icon: PercentCircle },
    { label: "Comissão Estimada", value: comissao != null ? fmtMoney(comissao, "short") : "—", icon: Coins },
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
    key: "vendas",
    label: "Vendas",
    align: "right",
    render: (r) => fmtInt(r.count ?? r.vendas ?? null),
  },
  {
    key: "vgv",
    label: "VGV",
    align: "right",
    render: (r) => (r.vgv != null ? fmtMoney(r.vgv, "short") : "—"),
    bar: (r) => r.vgv ?? 0,
  },
];
