/**
 * PipelineTeamVisitas — Compact collapsible panel showing the gerente's team visits
 * Displayed below manager actions in the Pipeline de Leads page.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isTomorrow, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronRight, Clock, User, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamVisita {
  id: string;
  corretor_id: string;
  corretor_nome: string;
  nome_cliente: string;
  empreendimento: string | null;
  data_visita: string;
  hora_visita: string | null;
  status: string;
}

const STATUS_DOT: Record<string, string> = {
  marcada: "bg-amber-500",
  confirmada: "bg-blue-500",
  realizada: "bg-emerald-500",
  reagendada: "bg-purple-500",
};

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "EEE dd/MM", { locale: ptBR });
}

export default function PipelineTeamVisitas() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const dateFrom = format(startOfDay(new Date()), "yyyy-MM-dd");
  const dateTo = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["pipeline-team-visitas", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      // Get team members managed by this gerente
      const { data: team } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("gerente_id", user!.id)
        .eq("status", "ativo");

      const teamUserIds = (team || []).map(t => t.user_id).filter(Boolean) as string[];
      if (teamUserIds.length === 0) return [];

      const { data, error } = await supabase
        .from("visitas")
        .select("id, corretor_id, nome_cliente, empreendimento, data_visita, hora_visita, status, corretor_nome")
        .in("corretor_id", teamUserIds)
        .gte("data_visita", dateFrom)
        .lte("data_visita", dateTo)
        .not("status", "in", '("cancelada","no_show")')
        .order("data_visita", { ascending: true })
        .order("hora_visita", { ascending: true });

      if (error) throw error;
      return (data || []) as TeamVisita[];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TeamVisita[]>();
    for (const v of visitas) {
      if (!map.has(v.data_visita)) map.set(v.data_visita, []);
      map.get(v.data_visita)!.push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visitas]);

  const todayCount = visitas.filter(v => isToday(new Date(v.data_visita + "T12:00:00"))).length;

  if (isLoading) return null;
  if (visitas.length === 0) return null;

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{
        background: "#fff",
        border: "1px solid #e8e8f0",
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 transition-colors hover:bg-[#f7f7fb]"
        style={{ height: 36, padding: "0 12px" }}
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 text-[#a1a1aa]" />
          : <ChevronRight className="h-3 w-3 text-[#a1a1aa]" />
        }
        <CalendarDays className="h-3.5 w-3.5 text-[#4F46E5]" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0a0a0a", letterSpacing: "-0.2px" }}>
          Visitas da Equipe
        </span>
        <span
          className="flex items-center justify-center rounded-full"
          style={{
            fontSize: 10, fontWeight: 700, color: "#4F46E5",
            background: "#4F46E5/8", minWidth: 20, height: 18,
            padding: "0 6px",
          }}
        >
          {visitas.length}
        </span>
        {todayCount > 0 && (
          <span
            className="rounded-full"
            style={{
              fontSize: 9, fontWeight: 700, color: "#fff",
              background: "#10b981", padding: "1px 6px",
            }}
          >
            {todayCount} hoje
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid #e8e8f0", maxHeight: 280, overflowY: "auto" }}>
          {grouped.map(([date, items]) => {
            const dayIsToday = isToday(new Date(date + "T12:00:00"));
            return (
              <div key={date}>
                {/* Day label */}
                <div
                  className="flex items-center gap-1.5 sticky top-0 z-10"
                  style={{
                    padding: "4px 12px",
                    background: dayIsToday ? "#4F46E5/5" : "#f7f7fb",
                    borderBottom: "1px solid #e8e8f0",
                  }}
                >
                  <span
                    className="capitalize"
                    style={{
                      fontSize: 11, fontWeight: 700,
                      color: dayIsToday ? "#4F46E5" : "#52525b",
                    }}
                  >
                    {getDayLabel(date)}
                  </span>
                  <span style={{ fontSize: 10, color: "#a1a1aa" }}>
                    · {items.length} visita{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Visit rows */}
                {items.map(v => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 hover:bg-[#f7f7fb] transition-colors"
                    style={{ padding: "6px 12px", borderBottom: "1px solid #f0f0f5" }}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[v.status] || "bg-gray-400")} />
                    
                    {v.hora_visita && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#0a0a0a", minWidth: 38 }}>
                        {v.hora_visita}
                      </span>
                    )}

                    <span
                      className="truncate"
                      style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", maxWidth: 90 }}
                      title={v.corretor_nome}
                    >
                      {(v.corretor_nome || "").split(" ")[0]}
                    </span>

                    <span className="text-[#a1a1aa]" style={{ fontSize: 10 }}>→</span>

                    <span
                      className="truncate flex-1 min-w-0"
                      style={{ fontSize: 11, color: "#52525b" }}
                      title={v.nome_cliente}
                    >
                      {v.nome_cliente}
                    </span>

                    {v.empreendimento && (
                      <span
                        className="truncate shrink-0"
                        style={{
                          fontSize: 9, fontWeight: 600, color: "#71717a",
                          background: "#f0f0f5", borderRadius: 4,
                          padding: "1px 5px", maxWidth: 100,
                        }}
                        title={v.empreendimento}
                      >
                        {v.empreendimento}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
