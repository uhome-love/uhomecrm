import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import type { CorretorRowV3 } from "@/hooks/useDashboardGerenteV3";

interface Props {
  rows: CorretorRowV3[];
  onRowClick?: (row: CorretorRowV3) => void;
}

function fmtBRL(v: number) {
  if (!v) return "R$ 0";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
}

export function TeamPerformanceTable({ rows, onRowClick }: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
        Nenhum corretor no time.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Corretor</th>
              <th className="px-3 py-3 font-medium text-muted-foreground text-right">Vendas</th>
              <th className="px-3 py-3 font-medium text-muted-foreground text-right">Leads</th>
              <th className="px-3 py-3 font-medium text-muted-foreground text-right">Visitas</th>
              <th className="px-3 py-3 font-medium text-muted-foreground text-right">Pipe</th>
              <th className="px-3 py-3 font-medium text-muted-foreground text-right">Negócios</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pipePct = r.pipe_total ? Math.round((r.pipe_em_dia / r.pipe_total) * 100) : 0;
              return (
                <tr
                  key={r.user_id}
                  onClick={() => onRowClick?.(r)}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/40"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={r.avatar_url ?? undefined} alt={r.nome} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {r.nome.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{r.nome}</p>
                        {r.meta_line && (
                          <p className="text-xs text-muted-foreground truncate">{r.meta_line}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-foreground tabular-nums">
                    {fmtBRL(r.vendas_vgv)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">{r.leads_total}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {r.visitas_realizadas}
                    <span className="text-muted-foreground">/{r.visitas_marcadas}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span
                      className={cn(
                        "font-medium",
                        pipePct >= 70
                          ? "text-success-700"
                          : pipePct >= 40
                          ? "text-warning-700"
                          : "text-danger-700"
                      )}
                    >
                      {pipePct}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">{r.negocios}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
