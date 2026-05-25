import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarX, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useDashboardGerenteV4Dia,
  type VisitasRangeV4,
  type VisitaV4,
} from "@/hooks/useDashboardGerenteV4Dia";

interface Props {
  gestorId: string | undefined;
}

const STATUS_STYLES: Record<string, string> = {
  confirmada: "bg-success-50 text-success-700 border-success-200",
  marcada: "bg-primary-50 text-primary-600 border-primary-200",
  agendada: "bg-primary-50 text-primary-600 border-primary-200",
  pendente: "bg-warning-50 text-warning-700 border-warning-200",
  reagendada: "bg-warning-50 text-warning-700 border-warning-200",
  realizada: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
};

function statusClass(s: string) {
  return STATUS_STYLES[s] ?? "bg-muted text-muted-foreground border-border";
}

function firstName(n: string | null) {
  return (n ?? "").split(" ")[0];
}

function Row({ v }: { v: VisitaV4 }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-mono font-medium text-foreground w-12 shrink-0">
        {v.horario_str}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {v.cliente_nome ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {v.imovel_resumo ?? "—"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Avatar className="h-6 w-6">
          <AvatarImage src={v.corretor_avatar ?? undefined} alt={v.corretor_nome ?? ""} />
          <AvatarFallback className="text-[10px]">
            {firstName(v.corretor_nome).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {firstName(v.corretor_nome)}
        </span>
      </div>
      <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", statusClass(v.status))}>
        {v.status.replace("_", " ")}
      </Badge>
    </div>
  );
}

export function V4PanelVisitas({ gestorId }: Props) {
  const [range, setRange] = useState<VisitasRangeV4>("hoje");
  const { data, isLoading } = useDashboardGerenteV4Dia(gestorId, range);
  const visitas = data?.visitas ?? [];

  const confirmadas = visitas.filter((v) => v.status === "confirmada").length;
  const pendentes = visitas.filter((v) => v.status === "pendente" || v.status === "reagendada").length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Visitas</h3>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
          {(["hoje", "semana"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                range === r
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "hoje" ? "Hoje" : "Semana"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : visitas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CalendarX className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma visita {range === "hoje" ? "hoje" : "nesta semana"}
            </p>
          </div>
        ) : (
          <div>
            {visitas.map((v) => (
              <Row key={v.visita_id} v={v} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {visitas.length} visitas · {confirmadas} confirmadas · {pendentes} pendentes
        </span>
        <Link
          to="/agenda-visitas"
          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
        >
          Ver agenda completa <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
