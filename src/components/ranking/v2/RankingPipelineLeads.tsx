import { useRankingData, type PipelineLeadsRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingPipelineLeads({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<PipelineLeadsRow>("pipeline", filters);

  const columns: Column<PipelineLeadsRow>[] = [
    { key: "ativos", label: "Ativos", align: "center", render: r => <span className="font-mono font-semibold">{r.ativos}</span> },
    { key: "etapas", label: "Por etapa (N · C · Q · VM)", align: "center", render: r => (
      <span className="text-xs font-mono text-muted-foreground">
        {r.novo} · {r.contato} · {r.qualificado} · <span className="text-foreground font-semibold">{r.visita_marcada}</span>
      </span>
    )},
    { key: "desat", label: "Desatualizados", align: "center", render: r => (
      <span className={`font-mono ${r.desatualizados > 0 ? "text-warning" : "text-muted-foreground"}`}>{r.desatualizados}</span>
    ), hint: "Leads sem ação há mais de 48h" },
    { key: "desc", label: "Descartes", align: "center", render: r => (
      <span className={`font-mono ${r.descartes > 0 ? "text-destructive/70" : "text-muted-foreground"}`}>{r.descartes}</span>
    )},
    { key: "aprov", label: "Aproveitamento", align: "right", render: r => (
      <span className="font-mono font-semibold text-success">{r.aproveitamento}%</span>
    ), hint: "Negócios criados / leads recebidos" },
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
