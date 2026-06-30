import { useQuery } from "@tanstack/react-query";
import { PhoneOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface SemContatoRow {
  corretor_id: string;
  corretor_nome: string | null;
  avatar_url: string | null;
  total: number;
  no_prazo: number;
  atrasado: number;
  risco: number;
}

export function V4PanelSemContato() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["dashboard-sem-contato"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_sem_contato");
      if (error) throw error;
      return (data ?? []) as SemContatoRow[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const totals = data.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.no_prazo += r.no_prazo;
      acc.atrasado += r.atrasado;
      acc.risco += r.risco;
      return acc;
    },
    { total: 0, no_prazo: 0, atrasado: 0, risco: 0 },
  );

  // Semáforo geral
  const semaforo =
    totals.atrasado > 0 || totals.risco > 0
      ? totals.atrasado >= 5 || totals.risco >= 5
        ? "vermelho"
        : "ambar"
      : "verde";

  const semaforoStyle =
    semaforo === "vermelho"
      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
      : semaforo === "ambar"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        : "bg-success-50 text-success-700";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
          <PhoneOff className="h-4 w-4 text-muted-foreground" />
          Sem Contato — cadência
        </h3>
      </div>

      {/* Resumo do time */}
      <div className={cn("rounded-lg p-2.5 mb-3 text-xs font-medium flex items-center justify-between", semaforoStyle)}>
        <span>
          {semaforo === "verde" ? "Time em dia" : semaforo === "ambar" ? "Atenção: leads atrasados" : "Crítico: muitos leads atrasados"}
        </span>
        <span className="tabular-nums font-bold">{totals.total} leads</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-border bg-success-50/50 p-2 text-center">
          <p className="text-lg font-bold tabular-nums text-success-700">{totals.no_prazo}</p>
          <p className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> Em dia</p>
        </div>
        <div className="rounded-lg border border-border bg-amber-50/50 p-2 text-center">
          <p className="text-lg font-bold tabular-nums text-amber-700">{totals.atrasado}</p>
          <p className="text-[10px] text-muted-foreground">Atrasados</p>
        </div>
        <div className="rounded-lg border border-border bg-red-50/50 p-2 text-center">
          <p className="text-lg font-bold tabular-nums text-red-700">{totals.risco}</p>
          <p className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Risco T6+</p>
        </div>
      </div>

      <div className="flex-1 min-h-[120px] space-y-1.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-success-500/70 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum lead em "Sem Contato"</p>
          </div>
        ) : (
          data.map((r) => (
            <div key={r.corretor_id} className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={r.avatar_url ?? undefined} alt={r.corretor_nome ?? ""} />
                <AvatarFallback className="text-[10px]">{(r.corretor_nome ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{r.corretor_nome ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">{r.total} leads na cadência</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold tabular-nums">
                <span className="text-success-600" title="Em dia">{r.no_prazo}</span>
                <span className="text-amber-600" title="Atrasados">{r.atrasado}</span>
                <span className="text-red-600" title="Risco T6+">{r.risco}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
