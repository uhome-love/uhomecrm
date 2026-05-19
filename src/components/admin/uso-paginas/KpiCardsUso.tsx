import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { StatsResult } from "@/hooks/useUsoPaginasStats";

interface Props {
  stats: StatsResult | undefined;
  zeroAccessCount: number;
  loading: boolean;
}

export function KpiCardsUso({ stats, zeroAccessCount, loading }: Props) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse h-28 bg-muted/30" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const topRoute = stats.top_routes?.[0];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card className="p-4">
        <div className="text-xs text-muted-foreground font-medium">Top #1 rota</div>
        <div className="mt-2 text-sm font-bold truncate" title={topRoute?.route_pattern}>
          {topRoute?.route_pattern ?? "—"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {topRoute?.visits ?? 0} visitas
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          Sessions
          <Tooltip>
            <TooltipTrigger asChild>
              <Info size={11} className="text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent>
              Session = aba do navegador.<br />
              Um usuário com 3 abas conta 3 sessions.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-2 text-2xl font-bold">{stats.sessions.toLocaleString("pt-BR")}</div>
      </Card>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground font-medium">Usuários únicos</div>
        <div className="mt-2 text-2xl font-bold">{stats.unique_users.toLocaleString("pt-BR")}</div>
      </Card>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground font-medium">Visitas totais</div>
        <div className="mt-2 text-2xl font-bold">{stats.total_visits.toLocaleString("pt-BR")}</div>
      </Card>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground font-medium">Rotas com 0 acessos</div>
        <div className="mt-2 text-2xl font-bold">{zeroAccessCount}</div>
        <div className="mt-1 text-xs text-muted-foreground">candidatas a remover</div>
      </Card>
    </div>
  );
}
