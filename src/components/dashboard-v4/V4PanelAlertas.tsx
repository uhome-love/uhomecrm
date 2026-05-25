import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AlertaCorretorV4 } from "@/hooks/useDashboardGerenteV4Kpis";

interface Props {
  alertas: AlertaCorretorV4[];
  isLoading: boolean;
}

function severityClass(score: number) {
  if (score >= 70) return "bg-destructive/10 text-destructive ring-1 ring-destructive/20";
  return "bg-warning-50 text-warning-700 ring-1 ring-warning-200";
}

export function V4PanelAlertas({ alertas, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Pipelines desatualizados</h3>
        <button
          onClick={() => navigate("/pipeline?view=modo-time")}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
        >
          Ver Modo Time <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 min-h-[200px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-success-500 mb-2" />
            <p className="text-sm text-muted-foreground">Time em dia. Nenhum pipeline crítico.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {alertas.map((a) => (
              <button
                key={a.corretor_id}
                onClick={() =>
                  navigate("/pipeline", {
                    state: { corretorFilter: a.auth_id, view: "modo-time" },
                  })
                }
                className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={a.avatar_url ?? undefined} alt={a.nome} />
                  <AvatarFallback className="text-xs">
                    {(a.nome ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.tarefas_atrasadas} atrasadas · {a.leads_sem_acao_30d} sem ação 30d
                  </p>
                </div>
                <div
                  className={cn(
                    "px-3 py-1 rounded-lg text-sm font-bold tabular-nums shrink-0",
                    severityClass(a.score_soma),
                  )}
                >
                  {a.score_soma}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 pt-3 border-t border-border text-[10px] text-muted-foreground">
        Score = tarefas atrasadas + leads sem ação 30d. ≥70 crítico, 40-69 atenção.
      </p>
    </div>
  );
}
