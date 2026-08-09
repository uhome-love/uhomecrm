import { Trophy, CalendarCheck2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
import { consolidarFunil, type FunilLinha } from "@/hooks/useFunilPerformance";

interface Props {
  linhas: FunilLinha[];
  loading: boolean;
  meuId?: string | null;
  onDrill?: (corretorAuthId: string, nome: string) => void;
  limit?: number;
}

const iniciais = (n: string | null) => (n ?? "?").split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const POS = ["bg-amber-100 text-amber-700", "bg-slate-200 text-slate-600", "bg-violet-100 text-violet-700"];

function RankCard({
  title, Icon, rows, metric, fmt, sub, max, meuId, onDrill,
}: {
  title: string; Icon: typeof Trophy; rows: FunilLinha[]; metric: (l: FunilLinha) => number;
  fmt: (l: FunilLinha) => string; sub: string; max: number; meuId?: string | null;
  onDrill?: (id: string, nome: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold text-foreground">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
      ) : (
        <div>
          {rows.map((l, i) => (
            <div
              key={l.corretor_auth_id}
              onClick={() => onDrill?.(l.corretor_auth_id, l.corretor_nome ?? "—")}
              className={cn(
                "flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0",
                onDrill && "cursor-pointer hover:bg-muted/40",
                meuId === l.corretor_auth_id && "bg-primary/[0.05]"
              )}
            >
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold", POS[i] ?? "bg-muted text-muted-foreground")}>
                {i + 1}
              </span>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={l.avatar_url ?? undefined} alt={l.corretor_nome ?? ""} />
                <AvatarFallback className="text-[9px]">{iniciais(l.corretor_nome)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-foreground">{l.corretor_nome ?? "—"}</div>
                <div className="mt-1 h-[5px] max-w-[160px] overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(metric(l) / max) * 100}%` }} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13.5px] font-extrabold tabular-nums text-foreground">{fmt(l)}</div>
                <div className="text-[10.5px] text-muted-foreground">{sub}</div>
              </div>
              {onDrill && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PerfRankings({ linhas, loading, meuId, onDrill, limit = 5 }: Props) {
  if (loading) {
    return (
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  const base = consolidarFunil(linhas);
  const porVgv = [...base].filter((l) => l.vgv_assinado > 0).sort((a, b) => b.vgv_assinado - a.vgv_assinado).slice(0, limit);
  const porVis = [...base].filter((l) => l.visitas_realizadas > 0).sort((a, b) => b.visitas_realizadas - a.visitas_realizadas).slice(0, limit);
  const maxVgv = Math.max(...porVgv.map((l) => l.vgv_assinado), 1);
  const maxVis = Math.max(...porVis.map((l) => l.visitas_realizadas), 1);

  return (
    <div className="grid gap-3.5 lg:grid-cols-2">
      <RankCard title="Ranking · VGV assinado" Icon={Trophy} rows={porVgv} metric={(l) => l.vgv_assinado}
        fmt={(l) => fmtMoney(l.vgv_assinado, "short")} sub="VGV assinado" max={maxVgv} meuId={meuId} onDrill={onDrill} />
      <RankCard title="Ranking · Visitas realizadas" Icon={CalendarCheck2} rows={porVis} metric={(l) => l.visitas_realizadas}
        fmt={(l) => `${l.visitas_realizadas}`} sub="realizadas" max={maxVis} meuId={meuId} onDrill={onDrill} />
    </div>
  );
}
