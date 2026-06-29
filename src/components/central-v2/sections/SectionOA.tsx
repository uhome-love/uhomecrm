import { Megaphone, PhoneCall, ThumbsUp, Users2, Handshake } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { KpiGrid, type KpiCardData } from "@/components/central-v2/shared/KpiCard";
import { MiniTable, type MiniColumn } from "@/components/central-v2/shared/MiniTable";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { safeGet } from "@/components/central-v2/shared/safeGet";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface ListaRow {
  lista_nome?: string;
  lista?: string;
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
  const loading = query.isLoading && !data;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={Megaphone}
        title="Oferta Ativa"
        subtitle="Prospecção ativa: tentativas, aproveitamento e conversão por lista"
      />

      {query.error ? (
        <SectionError query={query} label="Oferta Ativa" />
      ) : (
        <>
          <KpiGrid loading={loading} items={data ? buildKpis(data) : undefined} />
          <MiniTable<ListaRow>
            title="Top listas de origem"
            loading={loading}
            rows={safeGet<ListaRow[]>(data ?? {}, "extras.top_listas_origem", "OA top_listas_origem") ?? []}
            columns={listaColumns}
          />
        </>
      )}
    </section>
  );
}

function buildKpis(data: Record<string, unknown>): KpiCardData[] {
  const tentativas = safeGet<number>(data, "oferta_ativa.tentativas", "OA tentativas");
  const aproveitados = safeGet<number>(data, "oferta_ativa.aproveitados", "OA aproveitados");
  const ativos = safeGet<number>(data, "oferta_ativa.ativos_no_pipeline", "OA ativos_no_pipeline");
  const negocios = safeGet<number>(data, "oferta_ativa.negocios_da_oa", "OA negocios_da_oa");
  const conv = safeGet<number>(data, "oferta_ativa.conversao_pct", "OA conversao_pct");

  return [
    { label: "Tentativas", value: fmtInt(tentativas), icon: PhoneCall },
    {
      label: "Aproveitados",
      value: fmtInt(aproveitados),
      icon: ThumbsUp,
      hint: conv != null ? `${fmtPct(conv)} de conversão` : undefined,
    },
    { label: "Ativos no Pipeline", value: fmtInt(ativos), icon: Users2 },
    { label: "Negócios da OA", value: fmtInt(negocios), icon: Handshake },
  ];
}

const listaColumns: MiniColumn<ListaRow>[] = [
  {
    key: "lista",
    label: "Lista",
    align: "left",
    render: (r) => r.lista_nome ?? r.lista ?? r.nome ?? "—",
  },
  {
    key: "total",
    label: "Tentativas",
    align: "right",
    render: (r) => fmtInt(r.tentativas ?? r.total ?? null),
    bar: (r) => r.tentativas ?? r.total ?? 0,
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
    render: (r) => fmtPct(r.taxa_pct ?? r.taxa ?? null),
  },
];
