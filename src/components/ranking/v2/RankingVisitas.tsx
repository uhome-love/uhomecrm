import { useRankingData, type VisitasRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingVisitas({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<VisitasRow>("visitas", filters);

  const conv = (r: VisitasRow) => {
    const denom = r.realizadas + r.no_show;
    return denom > 0 ? (r.realizadas / denom) * 100 : 0;
  };

  const columns: Column<VisitasRow>[] = [
    { key: "criadas", label: "Criadas", align: "center", render: r => <span className="font-mono">{r.criadas}</span>, sortValue: r => r.criadas, hint: "Total de visitas no período" },
    { key: "no_show", label: "No-show", align: "center", render: r => <span className={`font-mono ${r.no_show > 0 ? "text-red-500" : ""}`}>{r.no_show}</span>, sortValue: r => r.no_show },
    { key: "conversao", label: "Conversão", align: "center", render: r => <span className="font-mono">{conv(r).toFixed(1)}%</span>, sortValue: r => conv(r), hint: "Realizadas / (Realizadas + No-show)" },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Ordenado por visitas realizadas · clique nas colunas para reordenar"
      primaryLabel="Realizadas"
      primaryRender={r => `${r.realizadas}`}
      primarySortValue={r => r.realizadas}
      highlightUserId={currentUserId}
    />
  );
}
