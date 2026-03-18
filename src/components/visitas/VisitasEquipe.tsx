/**
 * VisitasEquipe — Read-only view of teammates' visits
 * Allows a corretor to see their team's schedule to avoid conflicts.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isTomorrow, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, User, Building2, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamVisita {
  id: string;
  corretor_id: string;
  corretor_nome: string;
  nome_cliente: string;
  empreendimento: string | null;
  data_visita: string;
  hora_visita: string | null;
  local_visita: string | null;
  status: string;
  observacoes: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  marcada: { label: "Marcada", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  confirmada: { label: "Confirmada", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  realizada: { label: "Realizada", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  reagendada: { label: "Reagendada", className: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
  no_show: { label: "No Show", className: "bg-red-500/10 text-red-600 border-red-500/30" },
};

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "EEEE, dd/MM", { locale: ptBR });
}

// Generate unique colors per corretor for visual distinction
const CORRETOR_COLORS = [
  "border-l-emerald-500",
  "border-l-blue-500",
  "border-l-purple-500",
  "border-l-amber-500",
  "border-l-rose-500",
  "border-l-cyan-500",
  "border-l-indigo-500",
  "border-l-orange-500",
];

export default function VisitasEquipe() {
  const { user } = useAuth();
  
  // Fetch from today, 14 days ahead
  const dateFrom = format(startOfDay(new Date()), "yyyy-MM-dd");
  const dateTo = format(addDays(new Date(), 14), "yyyy-MM-dd");

  const { data: teamVisitas = [], isLoading } = useQuery({
    queryKey: ["team-visitas", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_visitas", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return (data || []) as TeamVisita[];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TeamVisita[]>();
    for (const v of teamVisitas) {
      // Skip cancelled/no_show
      if (v.status === "cancelada" || v.status === "no_show") continue;
      const key = v.data_visita;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [teamVisitas]);

  // Build corretor color map
  const corretorColors = useMemo(() => {
    const names = [...new Set(teamVisitas.map(v => v.corretor_nome))] as string[];
    const map = new Map<string, string>();
    names.forEach((n: string, i: number) => map.set(n, CORRETOR_COLORS[i % CORRETOR_COLORS.length]));
    return map;
  }, [teamVisitas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">Nenhuma visita agendada pelos colegas de equipe nos próximos 14 dias.</p>
      </div>
    );
  }

  // Legend
  const corretorList = [...new Set(teamVisitas.filter(v => v.status !== "cancelada" && v.status !== "no_show").map(v => v.corretor_nome))];

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
        <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Agenda da Equipe (somente leitura)</p>
          <p className="text-[11px] text-muted-foreground">Veja os horários dos colegas para evitar conflitos ao marcar suas visitas.</p>
        </div>
      </div>

      {/* Corretor legend */}
      {corretorList.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {(corretorList as string[]).map((name: string) => (
            <div key={name as string} className="flex items-center gap-1.5">
              <div className={cn("h-3 w-3 rounded-full", corretorColors.get(name as string)?.replace("border-l-", "bg-"))} />
              <span className="text-xs text-muted-foreground">{(name as string).split(" ")[0]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Days */}
      {grouped.map(([date, visitas]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background z-10 py-1">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-bold text-foreground capitalize">{getDayLabel(date)}</span>
            <Badge variant="outline" className="text-[10px] ml-1">{visitas.length} visita{visitas.length !== 1 ? "s" : ""}</Badge>
          </div>
          <div className="space-y-2">
            {visitas.map(v => {
              const statusInfo = STATUS_BADGE[v.status] || STATUS_BADGE.marcada;
              const colorClass = corretorColors.get(v.corretor_nome) || "border-l-primary";
              return (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-lg border bg-card p-3 border-l-4 transition-colors",
                    colorClass
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">
                          {v.corretor_nome?.split(" ").slice(0, 2).join(" ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-5.5">
                        Cliente: <span className="font-medium text-foreground">{v.nome_cliente}</span>
                      </p>
                      {v.empreendimento && (
                        <div className="flex items-center gap-1.5 pl-5.5">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{v.empreendimento}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {v.hora_visita && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-bold text-foreground">{v.hora_visita}</span>
                        </div>
                      )}
                      <Badge variant="outline" className={cn("text-[10px]", statusInfo.className)}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
