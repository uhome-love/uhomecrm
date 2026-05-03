import { useRankingData, type NegociosRow, type RankingFilters } from "@/hooks/useRankingsData";
import RankingTable, { type Column } from "./RankingTable";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function RankingNegocios({ filters, currentUserId }: { filters: RankingFilters; currentUserId?: string }) {
  const { data, loading } = useRankingData<NegociosRow>("negocios", filters);

  const columns: Column<NegociosRow>[] = [
    { key: "criados", label: "Criados", align: "center", render: r => <span className="font-mono">{r.criados}</span> },
    { key: "caidos", label: "Caídos", align: "center", render: r => (
      <span className={`font-mono ${r.caidos > 0 ? "text-destructive/70" : "text-muted-foreground"}`}>{r.caidos}</span>
    ), hint: "Negócios em fase 'distrato'" },
    { key: "assin", label: "Assinados", align: "center", render: r => (
      <span className="font-mono font-semibold text-success">{r.assinados}</span>
    )},
  ];

  return (
    <RankingTable
      rows={data}
      loading={loading}
      columns={columns}
      scoreLabel="VGV Assinado"
      scoreRender={r => fmtBRL(r.vgv_assinado)}
      highlightUserId={currentUserId}
    />
  );
}
