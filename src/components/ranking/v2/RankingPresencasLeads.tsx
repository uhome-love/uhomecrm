import { useRankingData, type PresencasLeadsRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingPresencasLeads({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<PresencasLeadsRow>("presencas", filters);

  const columns: Column<PresencasLeadsRow>[] = [
    { key: "diurna", label: "☀️ Diurna", align: "center", render: r => <span className="font-mono">{r.presencas_diurna}</span>, hint: "Manhã / Tarde / Dia todo" },
    { key: "noturna", label: "🌙 Noturna", align: "center", render: r => <span className="font-mono">{r.presencas_noturna}</span> },
    { key: "domingo", label: "🗓 Domingo", align: "center", render: r => <span className="font-mono">{r.presencas_domingo}</span> },
    { key: "total_pres", label: "Σ Presenças", align: "center", render: r => <span className="font-mono font-semibold">{r.presencas_total}</span> },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Ordenado por leads recebidos no período (desempate: total de presenças)"
      primaryLabel="Leads recebidos"
      primaryRender={r => `${r.leads_recebidos}`}
      highlightUserId={currentUserId}
    />
  );
}
