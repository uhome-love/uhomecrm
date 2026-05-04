import { useRankingData, type OfertaAtivaRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingOfertaAtiva({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<OfertaAtivaRow>("oferta_ativa", filters);

  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const columns: Column<OfertaAtivaRow>[] = [
    {
      key: "tentativas",
      label: "Tentativas",
      align: "center",
      hint: "Total de tentativas registradas no período",
      render: r => <span className="font-mono">{r.tentativas}</span>,
      sortValue: r => r.tentativas,
    },
    {
      key: "aproveitados",
      label: "Aproveitados",
      align: "center",
      hint: "Tentativas com resultado 'com_interesse'",
      render: r => (
        <span className={`font-mono ${r.aproveitados > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}`}>
          {r.aproveitados}
        </span>
      ),
      sortValue: r => r.aproveitados,
    },
    {
      key: "conversao",
      label: "Conversão",
      align: "center",
      hint: "Aproveitados / Tentativas",
      render: r => <span className="font-mono">{fmtPct(r.conversao_pct)}</span>,
      sortValue: r => r.conversao_pct,
    },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Score = média entre volume de tentativas e taxa de conversão (normalizados 0-100)"
      primaryLabel="Score"
      primaryRender={r => r.score.toFixed(1)}
      primarySortValue={r => r.score}
      highlightUserId={currentUserId}
    />
  );
}
