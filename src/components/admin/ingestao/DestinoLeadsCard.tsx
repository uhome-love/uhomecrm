import { Card } from "@/components/ui/card";
import type { DestinoCounts, DiarioRow } from "@/hooks/useIngestaoStats";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useMemo } from "react";

interface Props {
  destino: DestinoCounts | undefined;
  diario: DiarioRow[] | undefined;
  loading: boolean;
}

const MSG_LABEL: Record<string, string> = {
  queued_fila_ceo: "Fila CEO",
  lead_dedup_reactivated: "Dedup reativado",
  lead_dedup_skipped_pending: "Dedup pendente",
  lead_dedup_skipped_permanent: "Dedup permanente",
  "Lead insert failed": "Insert falhou",
};

const MSG_COLORS: Record<string, string> = {
  queued_fila_ceo: "hsl(var(--primary))",
  lead_dedup_reactivated: "hsl(142 71% 45%)",
  lead_dedup_skipped_pending: "hsl(48 96% 53%)",
  lead_dedup_skipped_permanent: "hsl(0 84% 60%)",
  "Lead insert failed": "hsl(0 72% 51%)",
};

export function DestinoLeadsCard({ destino, diario, loading }: Props) {
  const chartData = useMemo(() => {
    if (!diario) return [];
    const days = new Map<string, Record<string, string | number>>();
    for (const row of diario) {
      if (!days.has(row.dia)) days.set(row.dia, { dia: row.dia });
      days.get(row.dia)![row.message] = row.qtd;
    }
    return [...days.values()].sort((a, b) => String(a.dia).localeCompare(String(b.dia)));
  }, [diario]);

  if (loading && !destino) {
    return <Card className="p-6 h-96 animate-pulse bg-muted/30" />;
  }
  if (!destino) return null;

  const total =
    destino.distribuidos +
    destino.fila_ceo +
    destino.dedup_reactivated +
    destino.dedup_skipped_pending +
    destino.dedup_skipped_permanent +
    destino.insert_failed;

  const row = (label: string, n: number, color?: string) => {
    const pct = total > 0 ? ((n / total) * 100).toFixed(0) : "0";
    return (
      <div className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
        <div className="flex items-center gap-2">
          {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
          <span>{label}</span>
        </div>
        <div className="font-mono text-muted-foreground">
          {n} <span className="text-xs">({pct}%)</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-3">Destino dos leads</h3>
      <div className="space-y-0.5 mb-6">
        {row("Distribuídos", destino.distribuidos, "hsl(217 91% 60%)")}
        {row("Fila CEO (sem corretor)", destino.fila_ceo, MSG_COLORS.queued_fila_ceo)}
        {row("Dedup reativado", destino.dedup_reactivated, MSG_COLORS.lead_dedup_reactivated)}
        {row("Dedup pendente", destino.dedup_skipped_pending, MSG_COLORS.lead_dedup_skipped_pending)}
        {row("Dedup permanente", destino.dedup_skipped_permanent, MSG_COLORS.lead_dedup_skipped_permanent)}
        {row("Insert falhou", destino.insert_failed, MSG_COLORS["Lead insert failed"])}
      </div>

      <h4 className="text-xs font-medium text-muted-foreground mb-2">Últimos 7 dias (BRT)</h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {Object.keys(MSG_LABEL).map((msg) => (
              <Bar key={msg} dataKey={msg} stackId="a" fill={MSG_COLORS[msg]} name={MSG_LABEL[msg]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
