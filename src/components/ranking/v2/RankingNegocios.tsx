import type { RankingFilters } from "@/hooks/useRankingsData";
import { usePerformanceDashboard } from "@/hooks/usePerformance";
import { useEquipeUserIds, applyEquipeFilter } from "@/hooks/usePerformanceEquipeFilter";
import RankingTable, { type Column } from "./RankingTable";
import { fmtMoney } from "@/lib/fmtMoney";

type Row = {
  user_id: string;
  nome: string;
  qtd_negociacao: number;
  qtd_contrato: number;
  qtd_ganho: number;
  vgv_vendido: number;
};

export default function RankingNegocios({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, isLoading } = usePerformanceDashboard(filters.start, filters.end);
  const { data: equipeIds } = useEquipeUserIds(filters.equipeId);

  const rows: Row[] = applyEquipeFilter(data?.ranking, filters.equipeId ? equipeIds : undefined)
    .map((r) => ({
      user_id: r.auth_user_id,
      nome: r.nome,
      qtd_negociacao: r.qtd_negociacao,
      qtd_contrato: r.qtd_contrato,
      qtd_ganho: r.qtd_ganho,
      vgv_vendido: r.vgv_vendido,
    }))
    .sort((a, b) => b.vgv_vendido - a.vgv_vendido);

  const columns: Column<Row>[] = [
    { key: "negociacao", label: "Em Negociação", align: "center", hint: "WIP na etapa Em Negociação hoje", render: r => <span className="font-mono">{r.qtd_negociacao}</span>, sortValue: r => r.qtd_negociacao },
    { key: "contrato", label: "Em Contrato", align: "center", hint: "WIP na etapa Contrato hoje", render: r => <span className="font-mono">{r.qtd_contrato}</span>, sortValue: r => r.qtd_contrato },
    { key: "ganho", label: "Ganhos", align: "center", hint: "Vendas assinadas no período", render: r => <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{r.qtd_ganho}</span>, sortValue: r => r.qtd_ganho },
  ];

  return (
    <RankingTable
      rows={rows}
      loading={isLoading}
      columns={columns}
      caption="Ordenado por VGV assinado. Criados/Caídos entram na próxima extensão da RPC."
      primaryLabel="VGV Assinado"
      primaryRender={r => fmtMoney(r.vgv_vendido, "exact")}
      primarySortValue={r => r.vgv_vendido}
      highlightUserId={currentUserId}
    />
  );
}
