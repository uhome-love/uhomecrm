import { useRankingData, type PresencasLeadsRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingPresencasLeads({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<PresencasLeadsRow>("presencas", filters);

  const columns: Column<PresencasLeadsRow>[] = [
    { key: "diurna", label: "☀️ Diurna", align: "center", render: r => <span className="font-mono">{r.presencas_diurna}</span>, sortValue: r => r.presencas_diurna, hint: "Manhã / Tarde / Dia todo · clique para ordenar" },
    { key: "noturna", label: "🌙 Noturna", align: "center", render: r => <span className="font-mono">{r.presencas_noturna}</span>, sortValue: r => r.presencas_noturna },
    { key: "domingo", label: "🗓 Domingo", align: "center", render: r => <span className="font-mono">{r.presencas_domingo}</span>, sortValue: r => r.presencas_domingo },
    { key: "total_pres", label: "Σ Presenças", align: "center", render: r => <span className="font-mono font-semibold">{r.presencas_total}</span>, sortValue: r => r.presencas_total },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Ordenado por leads recebidos · clique nas colunas para reordenar"
      primaryLabel="Leads recebidos"
      primaryRender={r => `${r.leads_recebidos}`}
      primarySortValue={r => r.leads_recebidos}
      highlightUserId={currentUserId}
    />
  );
}
