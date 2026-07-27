import type { RankingFilters } from "@/hooks/useRankingsData";
import { usePerformanceDashboard } from "@/hooks/usePerformance";
import { useEquipeUserIds, applyEquipeFilter } from "@/hooks/usePerformanceEquipeFilter";
import RankingTable, { type Column } from "./RankingTable";

type Row = {
  user_id: string;
  nome: string;
  tentativas: number;
  aproveitados: number;
  conversao_pct: number;
};

export default function RankingOfertaAtiva({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, isLoading } = usePerformanceDashboard(filters.start, filters.end);
  const { data: equipeIds } = useEquipeUserIds(filters.equipeId);

  const rows: Row[] = applyEquipeFilter(data?.ranking, filters.equipeId ? equipeIds : undefined)
    .map((r) => ({
      user_id: r.auth_user_id,
      nome: r.nome,
      tentativas: r.qtd_tentativas_oa,
      aproveitados: r.qtd_oa_aproveitados,
      conversao_pct: r.qtd_tentativas_oa > 0 ? (r.qtd_oa_aproveitados / r.qtd_tentativas_oa) * 100 : 0,
    }))
    .sort((a, b) => b.tentativas - a.tentativas);

  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const columns: Column<Row>[] = [
    { key: "tentativas", label: "Tentativas", align: "center", hint: "Total de tentativas registradas no período", render: r => <span className="font-mono">{r.tentativas}</span>, sortValue: r => r.tentativas },
    { key: "aproveitados", label: "Aproveitados", align: "center", hint: "Tentativas com resultado 'com_interesse'", render: r => (
      <span className={`font-mono ${r.aproveitados > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}`}>{r.aproveitados}</span>
    ), sortValue: r => r.aproveitados },
    { key: "conversao", label: "Conversão", align: "center", hint: "Aproveitados / Tentativas", render: r => <span className="font-mono">{fmtPct(r.conversao_pct)}</span>, sortValue: r => r.conversao_pct },
  ];

  return (
    <RankingTable
      rows={rows}
      loading={isLoading}
      columns={columns}
      caption="Ordenado por volume de tentativas."
      primaryLabel="Tentativas"
      primaryRender={r => r.tentativas}
      primarySortValue={r => r.tentativas}
      highlightUserId={currentUserId}
    />
  );
}
