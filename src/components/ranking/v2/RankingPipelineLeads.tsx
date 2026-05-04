import { useRankingData, type PipelineLeadsRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingPipelineLeads({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<PipelineLeadsRow>("pipeline", filters);

  const columns: Column<PipelineLeadsRow>[] = [
    { key: "novo", label: "Novo", align: "center", render: r => <span className="font-mono">{r.novo}</span>, sortValue: r => r.novo },
    { key: "contato", label: "Contato", align: "center", render: r => <span className="font-mono">{r.contato}</span>, sortValue: r => r.contato },
    { key: "qualif", label: "Qualif.", align: "center", render: r => <span className="font-mono">{r.qualificado}</span>, sortValue: r => r.qualificado },
    { key: "visita", label: "Visita marc.", align: "center", render: r => <span className="font-mono">{r.visita_marcada}</span>, sortValue: r => r.visita_marcada },
    {
      key: "stale",
      label: "⚠️ Desatualizados",
      align: "center",
      hint: "Sem ação há mais de 48h",
      sortValue: r => r.desatualizados,
      render: r => <span className={`font-mono ${r.desatualizados > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>{r.desatualizados}</span>,
    },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Snapshot atual · clique nas colunas para reordenar"
      primaryLabel="Leads ativos"
      primaryRender={r => `${r.ativos}`}
      primarySortValue={r => r.ativos}
      highlightUserId={currentUserId}
    />
  );
}
