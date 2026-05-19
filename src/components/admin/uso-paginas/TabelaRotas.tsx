import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import type { TableRow } from "@/hooks/useUsoPaginasStats";

interface Props {
  rows: TableRow[] | undefined;
  loading: boolean;
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
}

export function TabelaRotas({ rows, loading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading && !rows) {
    return <Card className="p-6 animate-pulse h-96 bg-muted/30" />;
  }
  if (!rows?.length) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhuma visita no período selecionado.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold text-sm">Todas as rotas visitadas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ordenado por número de visitas
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium w-6"></th>
              <th className="text-left px-4 py-2 font-medium">Rota</th>
              <th className="text-right px-4 py-2 font-medium">Visitas</th>
              <th className="text-right px-4 py-2 font-medium">Usuários</th>
              <th className="text-right px-4 py-2 font-medium">Tempo médio</th>
              <th className="text-right px-4 py-2 font-medium">Última visita</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = expanded === r.route_pattern;
              return (
                <tr key={r.route_pattern} className="border-t hover:bg-muted/20">
                  <td className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setExpanded(isOpen ? null : r.route_pattern)}
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </Button>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.route_pattern}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.visits.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.unique_users}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                    {fmtDuration(r.median_duration_ms)}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                    {formatBRT(r.last_viewed, "dd/MM HH:mm")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
