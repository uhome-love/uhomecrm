import { useRankingData, type VisitasRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingVisitas({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<VisitasRow>("visitas", filters);

  const columns: Column<VisitasRow>[] = [
    { key: "criadas", label: "Criadas", align: "center", render: r => <span className="font-mono">{r.criadas}</span>, hint: "Total de visitas no período" },
    { key: "marcadas", label: "Marcadas", align: "center", render: r => <span className="font-mono">{r.marcadas}</span> },
    { key: "no_show", label: "No-show", align: "center", render: r => <span className={`font-mono ${r.no_show > 0 ? "text-red-500" : ""}`}>{r.no_show}</span> },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Ordenado por visitas realizadas no período (desempate: visitas criadas)"
      primaryLabel="Realizadas"
      primaryRender={r => `${r.realizadas}`}
      highlightUserId={currentUserId}
    />
  );
}
