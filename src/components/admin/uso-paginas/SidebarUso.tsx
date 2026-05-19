import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { StatsResult } from "@/hooks/useUsoPaginasStats";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-500",
  gestor: "bg-blue-500",
  corretor: "bg-emerald-500",
  backoffice: "bg-amber-500",
  rh: "bg-pink-500",
  unknown: "bg-muted-foreground",
};

interface Props {
  stats: StatsResult | undefined;
  zeroAccess: string[];
}

export function SidebarUso({ stats, zeroAccess }: Props) {
  if (!stats) return null;

  const total = stats.role_distribution.reduce((s, r) => s + Number(r.visits), 0);
  const unknownPct = Number(stats.unknown_pct ?? 0);

  return (
    <div className="space-y-4">
      {unknownPct > 1 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="pt-4 text-sm flex gap-2">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={16} />
            <div>
              <strong>{stats.unknown_visits}</strong> visitas a rotas não mapeadas
              ({unknownPct.toFixed(1)}%).<br />
              Atualize <code className="text-xs bg-muted px-1 rounded">src/lib/routePatterns.ts</code>.
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3">Top 5 mais visitadas</h4>
        <ol className="space-y-1.5 text-xs">
          {stats.top_routes.map((r, i) => (
            <li key={r.route_pattern} className="flex justify-between gap-2">
              <span className="flex gap-2 min-w-0">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span className="font-mono truncate">{r.route_pattern}</span>
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0">{r.visits}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3">Distribuição por role</h4>
        <div className="space-y-2 text-xs">
          {stats.role_distribution.map((r) => {
            const pct = total > 0 ? (Number(r.visits) / total) * 100 : 0;
            return (
              <div key={r.role}>
                <div className="flex justify-between mb-1">
                  <span className="capitalize">{r.role}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.visits} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full ${ROLE_COLORS[r.role] ?? "bg-muted-foreground"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3">
          0 acessos no período <span className="text-xs text-muted-foreground">({zeroAccess.length})</span>
        </h4>
        {zeroAccess.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todas as rotas tiveram acesso.</p>
        ) : (
          <ul className="space-y-1 text-xs max-h-72 overflow-auto">
            {zeroAccess.map((p) => (
              <li key={p} className="font-mono text-muted-foreground truncate" title={p}>
                {p}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
