import { useRankingData, type PipelineLeadsRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

export default function RankingPipelineLeads({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<PipelineLeadsRow>("pipeline", filters);

  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const columns: Column<PipelineLeadsRow>[] = [
    {
      key: "ativos",
      label: "Ativos",
      align: "center",
      hint: "Snapshot atual: leads não arquivados, fora de Descarte",
      render: r => <span className="font-mono">{r.ativos}</span>,
      sortValue: r => r.ativos,
    },
    {
      key: "recebidos",
      label: "Recebidos",
      align: "center",
      hint: "Leads recebidos no período selecionado",
      render: r => <span className="font-mono text-muted-foreground">{r.recebidos_periodo}</span>,
      sortValue: r => r.recebidos_periodo,
    },
    {
      key: "virou_visita",
      label: "Virou visita",
      align: "center",
      hint: "Recebidos no período que chegaram em Visita Marcada ou além",
      render: r => <span className="font-mono">{r.virou_visita}</span>,
      sortValue: r => r.virou_visita,
    },
    {
      key: "virou_negocio",
      label: "Virou negócio",
      align: "center",
      hint: "Recebidos no período que chegaram em Negócio Criado ou além",
      render: r => (
        <span className={`font-mono ${r.virou_negocio > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}`}>
          {r.virou_negocio}
        </span>
      ),
      sortValue: r => r.virou_negocio,
    },
    {
      key: "sla",
      label: "⚠️ SLA atrasado",
      align: "center",
      hint: "Leads ativos sem ação há mais de 48h (BRT)",
      render: r => (
        <span className={`font-mono ${r.sla_atrasado > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
          {r.sla_atrasado}
        </span>
      ),
      sortValue: r => r.sla_atrasado,
    },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Conversão = Virou visita / Recebidos no período · clique nas colunas para reordenar"
      primaryLabel="Conversão"
      primaryRender={r => fmtPct(r.conversao_pct)}
      primarySortValue={r => r.conversao_pct}
      highlightUserId={currentUserId}
    />
  );
}
