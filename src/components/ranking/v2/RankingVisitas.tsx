import { useRankingData, type VisitasRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingVisitas({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<VisitasRow>("visitas", filters);

  const columns: Column<VisitasRow>[] = [
    { key: "criadas", label: "Criadas", align: "center", render: r => <span className="font-mono">{r.criadas}</span> },
    { key: "real", label: "Realizadas", align: "center", render: r => <span className="font-mono font-semibold text-success">{r.realizadas}</span> },
    { key: "ns", label: "No-show", align: "center", render: r => (
      <span className={`font-mono ${r.no_show > 0 ? "text-destructive/70" : "text-muted-foreground"}`}>{r.no_show}</span>
    )},
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      scoreLabel="Pontos"
      scoreRender={r => `${r.score}`}
      highlightUserId={currentUserId}
    />
  );
}
