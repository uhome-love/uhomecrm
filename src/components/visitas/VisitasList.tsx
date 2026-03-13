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
  showTeam?: boolean;
  mode?: "upcoming" | "past" | "all";
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

function buildGroups(visitas: Visita[]): DateGroup[] {
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
      isPast: isBefore(d, today) && !isToday(d),
      visitas: vs,
      realizadas,
      total: vs.length,
    });
  }

  return result;
}

function DateGroupCard({
  g,
  isOpen,
  onToggle,
  showCorretor,
  showTeam,
  onUpdateStatus,
  onEdit,
  onDelete,
}: {
  g: DateGroup;
  isOpen: boolean;
  onToggle: () => void;
  showCorretor?: boolean;
  showTeam?: boolean;
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  onDelete?: (id: string) => void;
}) {
  const taxa = g.total > 0 ? Math.round((g.realizadas / g.total) * 100) : 0;

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden bg-card",
      g.isToday ? "border-primary/30" : "border-border/40"
    )}>
      {/* 10️⃣ Day header — clean */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors",
          g.isToday
            ? "bg-primary/8 hover:bg-primary/12"
            : g.isPast
              ? "bg-muted/20 hover:bg-muted/30"
              : "hover:bg-accent/20"
        )}
      >
        {isOpen
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        }

        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className={cn(
            "text-xs font-black uppercase tracking-wide",
            g.isToday ? "text-primary" : g.isPast ? "text-muted-foreground/70" : "text-foreground"
          )}>
            {g.dayOfWeek}
          </span>
          <span className="text-[11px] text-muted-foreground/60">•</span>
          <span className={cn(
            "text-[11px] font-medium",
            g.isToday ? "text-primary/70" : "text-muted-foreground/60"
          )}>
            {g.label}
          </span>
        </div>

        {g.isToday && (
          <Badge className="bg-primary text-primary-foreground text-[9px] font-black px-2 py-0 border-0 shrink-0">
            HOJE
          </Badge>
        )}

        <div className="flex items-center gap-2 shrink-0 text-[11px]">
          <span className="text-muted-foreground font-semibold tabular-nums">
            {g.total} visita{g.total !== 1 ? "s" : ""}
          </span>
          {g.realizadas > 0 && (
            <span className="text-green-600 font-bold tabular-nums">
              {g.realizadas} ✅
            </span>
          )}
          {g.isPast && g.total > 0 && (
            <Badge variant="outline" className={cn(
              "text-[9px] px-1.5 py-0 font-black tabular-nums",
              taxa >= 80 ? "border-green-300 text-green-700"
                : taxa >= 50 ? "border-amber-300 text-amber-700"
                  : "border-red-300 text-red-700"
            )}>
              {taxa}%
            </Badge>
          )}
        </div>
      </button>

      {/* 11️⃣ Visitas — with clear separation */}
      {isOpen && (
        <div>
          {g.visitas.map(v => {
            const isPastPending = g.isPast && (v.status === "marcada" || v.status === "confirmada");
            return (
              <VisitaRow
                key={v.id}
                visita={v}
                onUpdateStatus={onUpdateStatus}
                onEdit={onEdit}
                onDelete={onDelete}
                showCorretor={showCorretor}
                showTeam={showTeam}
                isPastPending={isPastPending}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VisitasList({ visitas, onUpdateStatus, onEdit, onDelete, showCorretor, showTeam, mode = "upcoming" }: Props) {
  const displayGroups = useMemo(() => {
    const groups = buildGroups(visitas);
    if (mode === "past") {
      return groups.filter(g => g.isPast).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    }
    if (mode === "all") {
      return groups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }
    return groups.filter(g => !g.isPast).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [visitas, mode]);

  const toggle = (dateStr: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
      return next;
    });
  };

  if (displayGroups.length === 0) {
    return (
      <div className="text-center py-8 rounded-lg border border-dashed border-border/40 bg-muted/10">
        <CalendarDays className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">
          {mode === "past" ? "Nenhuma visita anterior encontrada" : mode === "all" ? "Nenhuma visita encontrada" : "Nenhuma visita futura agendada"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayGroups.map(g => (
        <DateGroupCard
          key={g.dateStr}
          g={g}
          isOpen={!collapsed.has(g.dateStr)}
          onToggle={() => toggle(g.dateStr)}
          showCorretor={showCorretor}
          showTeam={showTeam}
          onUpdateStatus={onUpdateStatus}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
