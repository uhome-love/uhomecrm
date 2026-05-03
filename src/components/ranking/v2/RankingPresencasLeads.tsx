import { useRankingData, type PresencasLeadsRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingPresencasLeads({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<PresencasLeadsRow>("presencas", filters);

  const columns: Column<PresencasLeadsRow>[] = [
    { key: "diurna", label: "☀️ Diurna", align: "center", render: r => <span className="font-mono">{r.presencas_diurna}</span>, hint: "Presenças aprovadas em janelas manhã/tarde" },
    { key: "noturna", label: "🌙 Noturna", align: "center", render: r => <span className="font-mono">{r.presencas_noturna}</span> },
    { key: "domingo", label: "🗓 Domingo", align: "center", render: r => <span className="font-mono">{r.presencas_domingo}</span> },
    { key: "leads", label: "Leads recebidos", align: "right", render: r => <span className="font-mono font-semibold">{r.leads_recebidos}</span> },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      scoreLabel="Score"
      scoreRender={r => `${r.score}`}
      highlightUserId={currentUserId}
    />
  );
}
