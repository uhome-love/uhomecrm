import { TrendingUp } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiRow, type KpiItem } from "@/components/central-v2/shared/KpiRow";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface EmpRow {
  empreendimento?: string;
  nome?: string;
  vendas?: number;
  vgv?: number;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

export function SectionVendas({ query }: Props) {
  const data = query.data;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <TrendingUp className="h-5 w-5 text-primary" strokeWidth={1.75} />
        <h2 className="font-display text-xl text-foreground">Vendas</h2>
      </div>

      {query.error ? (
        <SectionError query={query} label="Vendas" />
      ) : (
        <>
          <KpiRow
            loading={query.isLoading && !data}
            items={data ? buildKpis(data) : undefined}
          />
          <MiniTable<EmpRow>
            title="Top empreendimentos"
            loading={query.isLoading && !data}
            rows={safeGet<EmpRow[]>(data ?? {}, "extras.por_empreendimento", "Vendas por_empreendimento") ?? []}
            columns={columns}
          />
        </>
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>): KpiItem[] {
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
    },
    { label: "Vendas", value: fmtInt(count) },
    { label: "Ticket Médio", value: ticket != null ? fmtMoney(ticket, "short") : "—" },
    { label: "Comissão Estimada", value: comissao != null ? fmtMoney(comissao, "short") : "—" },
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
    render: (r) => fmtInt(r.vendas ?? null),
  },
  {
    key: "vgv",
    label: "VGV",
    align: "right",
    render: (r) => (r.vgv != null ? fmtMoney(r.vgv, "short") : "—"),
  },
];
