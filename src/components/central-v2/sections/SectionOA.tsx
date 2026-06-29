import { Megaphone } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiRow, type KpiItem } from "@/components/central-v2/shared/KpiRow";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { safeGet } from "@/components/central-v2/shared/safeGet";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface ListaRow {
  lista?: string;
  lista_nome?: string;
  nome?: string;
  total?: number;
  tentativas?: number;
  aproveitados?: number;
  taxa?: number;
  taxa_pct?: number;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export function SectionOA({ query }: Props) {
  const data = query.data;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Megaphone className="h-5 w-5 text-primary" strokeWidth={1.75} />
        <h2 className="font-display text-xl text-foreground">Oferta Ativa</h2>
      </div>

      {query.error ? (
        <SectionError query={query} label="Oferta Ativa" />
      ) : (
        <>
          <KpiRow
            loading={query.isLoading && !data}
            items={data ? buildKpis(data) : undefined}
          />
          <MiniTable<ListaRow>
            title="Top listas de origem"
            loading={query.isLoading && !data}
            rows={safeGet<ListaRow[]>(data ?? {}, "extras.top_listas_origem", "OA top_listas_origem") ?? []}
            columns={listaColumns}
          />
        </>
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>): KpiItem[] {
  const tentativas = safeGet<number>(data, "oferta_ativa.tentativas", "OA tentativas");
  const aproveitados = safeGet<number>(data, "oferta_ativa.aproveitados", "OA aproveitados");
  const ativos = safeGet<number>(data, "oferta_ativa.ativos_no_pipeline", "OA ativos_no_pipeline");
  const negocios = safeGet<number>(data, "oferta_ativa.negocios_da_oa", "OA negocios_da_oa");

  return [
    { label: "Tentativas", value: fmtInt(tentativas) },
    { label: "Aproveitados", value: fmtInt(aproveitados) },
    { label: "Ativos no Pipeline", value: fmtInt(ativos) },
    { label: "Negócios da OA", value: fmtInt(negocios) },
  ];
}

const listaColumns: MiniColumn<ListaRow>[] = [
  {
    key: "lista",
    label: "Lista",
    align: "left",
    render: (r) => r.lista ?? r.nome ?? "—",
  },
  {
    key: "total",
    label: "Tentativas",
    align: "right",
    render: (r) => fmtInt(r.total ?? null),
  },
  {
    key: "aproveitados",
    label: "Aproveitados",
    align: "right",
    render: (r) => fmtInt(r.aproveitados ?? null),
  },
  {
    key: "taxa",
    label: "Taxa",
    align: "right",
    render: (r) => fmtPct(r.taxa ?? null),
  },
];
