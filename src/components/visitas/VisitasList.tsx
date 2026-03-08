import { useMemo, useState } from "react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import VisitaRow from "./VisitaRow";

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  onDelete?: (id: string) => void;
  showCorretor?: boolean;
}

interface DateGroup {
  dateStr: string;
  label: string;
  dayOfWeek: string;
  isToday: boolean;
  isPast: boolean;
  visitas: Visita[];
  realizadas: number;
  total: number;
}

export default function VisitasList({ visitas, onUpdateStatus, onEdit, onDelete, showCorretor }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const map = new Map<string, Visita[]>();

    for (const v of visitas) {
      const key = v.data_visita;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }

    const result: DateGroup[] = [];
    for (const [dateStr, vs] of map) {
      const d = new Date(dateStr + "T12:00:00");
      const realizadas = vs.filter(v => v.status === "realizada").length;
      vs.sort((a, b) => (a.hora_visita || "99:99").localeCompare(b.hora_visita || "99:99"));

      result.push({
        dateStr,
        label: format(d, "dd 'de' MMMM", { locale: ptBR }),
        dayOfWeek: format(d, "EEEE", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
        isToday: isToday(d),
        isPast: isBefore(d, today),
        visitas: vs,
        realizadas,
        total: vs.length,
      });
    }

    return result;
  }, [visitas]);

  const toggle = (dateStr: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
      return next;
    });
  };

  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita encontrada.</p>;
  }

  return (
    <div className="space-y-2">
      {groups.map(g => {
        const isOpen = !collapsed.has(g.dateStr);
        const taxa = g.total > 0 ? Math.round((g.realizadas / g.total) * 100) : 0;

        return (
          <div key={g.dateStr} className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm">
            {/* Date group header */}
            <button
              onClick={() => toggle(g.dateStr)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                g.isToday
                  ? "bg-[hsl(221,83%,53%)] text-white"
                  : g.isPast
                    ? "bg-muted/50 text-muted-foreground"
                    : "bg-[hsl(222,47%,11%)] text-white"
              )}
            >
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <CalendarDays className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold">{g.dayOfWeek}</span>
                <span className={cn("text-sm ml-2", g.isToday ? "text-white/80" : g.isPast ? "text-muted-foreground" : "text-white/70")}>
                  {g.label}
                </span>
              </div>
              {g.isToday && (
                <Badge className="bg-white text-[hsl(221,83%,53%)] text-[10px] font-bold px-2 py-0.5 border-0 shrink-0">
                  HOJE
                </Badge>
              )}
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-xs font-medium", g.isToday ? "text-white/80" : g.isPast ? "text-muted-foreground" : "text-white/70")}>
                  {g.total} visita{g.total !== 1 ? "s" : ""}
                </span>
                {g.realizadas > 0 && (
                  <span className="text-xs text-green-400 font-semibold">
                    {g.realizadas} ✅
                  </span>
                )}
                {g.isPast && g.total > 0 && (
                  <Badge className={cn(
                    "text-[10px] px-1.5 py-0 border font-bold",
                    taxa >= 80 ? "bg-green-100 text-green-700 border-green-300"
                      : taxa >= 50 ? "bg-amber-100 text-amber-700 border-amber-300"
                        : "bg-red-100 text-red-700 border-red-300"
                  )}>
                    {taxa}%
                  </Badge>
                )}
              </div>
            </button>

            {/* Visita rows */}
            {isOpen && (
              <div className="divide-y divide-border/40">
                {g.visitas.map(v => {
                  const isPastPending = g.isPast && (v.status === "marcada" || v.status === "confirmada");
                  return (
                    <VisitaRow
                      key={v.id}
                      visita={v}
                      onUpdateStatus={onUpdateStatus}
                      onDelete={onDelete}
                      showCorretor={showCorretor}
                      isPastPending={isPastPending}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
