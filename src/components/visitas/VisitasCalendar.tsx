import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isToday, isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, type Visita } from "@/hooks/useVisitas";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STATUS_DOT_COLORS: Record<string, string> = {
  marcada: "bg-amber-400",
  confirmada: "bg-blue-500",
  realizada: "bg-green-500",
  reagendada: "bg-purple-500",
  cancelada: "bg-gray-400",
  no_show: "bg-red-500",
};

// Generate distinct colors for corretors
const CORRETOR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
  "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

interface Props {
  visitas: Visita[];
  onDayClick?: (date: Date) => void;
}

export default function VisitasCalendar({ visitas, onDayClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Build a map of corretor_id -> color
  const corretorColorMap = useMemo(() => {
    const ids = [...new Set(visitas.map(v => v.corretor_id))];
    const map = new Map<string, string>();
    ids.forEach((id, i) => map.set(id, CORRETOR_COLORS[i % CORRETOR_COLORS.length]));
    return map;
  }, [visitas]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let d = calStart;
    while (d <= calEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [currentMonth]);

  const visitasByDate = useMemo(() => {
    const map: Record<string, Visita[]> = {};
    for (const v of visitas) {
      const key = v.data_visita;
      if (!map[key]) map[key] = [];
      map[key].push(v);
    }
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (a.hora_visita || "99:99").localeCompare(b.hora_visita || "99:99"))
    );
    return map;
  }, [visitas]);

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-bold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentMonth(new Date())}>
            Hoje
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px">
          {weekDays.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {calendarDays.map(day => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayVisitas = visitasByDate[dateKey] || [];
            const today = isToday(day);
            const inMonth = isSameMonth(day, currentMonth);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={dateKey}
                className={cn(
                  "bg-card min-h-[90px] p-1.5 cursor-pointer hover:bg-muted/30 transition-colors flex flex-col",
                  today && "ring-2 ring-primary/30 ring-inset bg-primary/[0.02]",
                  isWeekend && "bg-muted/10",
                  !inMonth && "opacity-40"
                )}
                onClick={() => onDayClick?.(day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center",
                    today ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayVisitas.length > 0 && (
                    <span className="text-[10px] font-semibold text-muted-foreground">{dayVisitas.length}</span>
                  )}
                </div>

                {/* Corretor color dots */}
                {dayVisitas.length > 0 && (
                  <div className="flex items-center gap-0.5 mb-1 flex-wrap">
                    {[...new Set(dayVisitas.map(v => v.corretor_id))].map(cid => (
                      <div
                        key={cid}
                        className={cn("h-2 w-2 rounded-full", corretorColorMap.get(cid) || "bg-gray-400")}
                      />
                    ))}
                  </div>
                )}

                {/* Visit events (max 3 visible) */}
                <div className="space-y-0.5 flex-1 overflow-hidden">
                  {dayVisitas.slice(0, 3).map(v => (
                    <Tooltip key={v.id}>
                      <TooltipTrigger asChild>
                        <div className="text-[9px] leading-tight px-1 py-0.5 rounded bg-muted/50 truncate cursor-default flex items-center gap-1">
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT_COLORS[v.status])} />
                          <span className="font-medium truncate">
                            {v.hora_visita ? v.hora_visita.slice(0, 5) + " " : ""}
                            {v.nome_cliente}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">{v.nome_cliente}</p>
                          {v.corretor_nome && <p className="text-[10px] text-muted-foreground">👤 {v.corretor_nome}</p>}
                          {v.empreendimento && <p className="text-[10px] text-muted-foreground">🏠 {v.empreendimento}</p>}
                          {v.hora_visita && <p className="text-[10px]">🕐 {v.hora_visita.slice(0, 5)}</p>}
                          <Badge variant="secondary" className="text-[9px]">
                            {STATUS_LABELS[v.status]}
                          </Badge>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {dayVisitas.length > 3 && (
                    <p className="text-[9px] text-muted-foreground text-center">+{dayVisitas.length - 3} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
