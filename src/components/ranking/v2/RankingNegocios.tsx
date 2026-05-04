import { useRankingData, type NegociosRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

const fmtBRL = (n: number) =>
  n >= 1_000_000
    ? `R$ ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `R$ ${(n / 1_000).toFixed(0)}k`
    : `R$ ${n.toFixed(0)}`;

export default function RankingNegocios({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<NegociosRow>("negocios", filters);

  const columns: Column<NegociosRow>[] = [
    { key: "criados", label: "Criados", align: "center", render: r => <span className="font-mono">{r.criados}</span>, hint: "Negócios criados no período (created_at)" },
    { key: "caidos", label: "Caídos", align: "center", render: r => <span className={`font-mono ${r.caidos > 0 ? "text-red-500" : ""}`}>{r.caidos}</span>, hint: "Distratos (mudança para fase 'distrato' no período)" },
    { key: "assinados", label: "Assinados", align: "center", render: r => <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{r.assinados}</span>, hint: "Vendas com data de assinatura no período" },
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      caption="Ordenado por VGV de vendas assinadas no período (desempate: nº de assinaturas)"
      primaryLabel="VGV Assinado"
      primaryRender={r => fmtBRL(r.vgv_assinado)}
      highlightUserId={currentUserId}
    />
  );
}
