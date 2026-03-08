import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, type Visita } from "@/hooks/useVisitas";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STATUS_EVENT_COLORS: Record<string, string> = {
  marcada: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
  confirmada: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  realizada: "bg-gray-400/15 border-gray-400/40 text-gray-600 dark:text-gray-400",
  reagendada: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
  cancelada: "bg-red-400/15 border-red-400/40 text-red-600 dark:text-red-400 line-through opacity-60",
  no_show: "bg-red-700/15 border-red-700/40 text-red-700 dark:text-red-400 opacity-60",
};

interface Props {
  visitas: Visita[];
  onDayClick?: (date: Date) => void;
}

export default function VisitasCalendar({ visitas, onDayClick }: Props) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      result.push(addDays(currentWeekStart, i));
    }
    return result;
  }, [currentWeekStart]);

  const visitasByDate = useMemo(() => {
    const map: Record<string, Visita[]> = {};
    for (const v of visitas) {
      const key = v.data_visita;
      if (!map[key]) map[key] = [];
      map[key].push(v);
    }
    // Sort by time within each day
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (a.hora_visita || "99:99").localeCompare(b.hora_visita || "99:99"))
    );
    return map;
  }, [visitas]);

  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-bold">
              {format(currentWeekStart, "dd MMM", { locale: ptBR })} — {format(addDays(currentWeekStart, 6), "dd MMM yyyy", { locale: ptBR })}
            </h3>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToToday}>
            Hoje
          </Button>
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {days.map(day => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayVisitas = visitasByDate[dateKey] || [];
            const today = isToday(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={dateKey}
                className={cn(
                  "bg-card min-h-[140px] p-1.5 cursor-pointer hover:bg-muted/30 transition-colors flex flex-col",
                  today && "ring-2 ring-primary/30 ring-inset bg-primary/[0.02]",
                  isWeekend && "bg-muted/20"
                )}
                onClick={() => onDayClick?.(day)}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-[11px] font-medium capitalize",
                    today ? "text-primary font-bold" : "text-foreground"
                  )}>
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                  <span className={cn(
                    "text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center",
                    today ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-0.5 flex-1 overflow-auto">
                  {dayVisitas.map(v => (
                    <Tooltip key={v.id}>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "text-[9px] leading-tight px-1.5 py-1 rounded border truncate cursor-default",
                          STATUS_EVENT_COLORS[v.status]
                        )}>
                          <span className="font-semibold">
                            {v.hora_visita ? v.hora_visita.slice(0, 5) + " " : ""}
                          </span>
                          {v.nome_cliente}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">{v.nome_cliente}</p>
                          {v.corretor_nome && <p className="text-[10px] text-muted-foreground">Corretor: {v.corretor_nome}</p>}
                          {v.empreendimento && <p className="text-[10px] text-muted-foreground">{v.empreendimento}</p>}
                          {v.hora_visita && <p className="text-[10px]">🕐 {v.hora_visita.slice(0, 5)}</p>}
                          <Badge className={cn("text-[9px]", STATUS_EVENT_COLORS[v.status])}>
                            {STATUS_LABELS[v.status]}
                          </Badge>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                {dayVisitas.length === 0 && (
                  <p className="text-[9px] text-muted-foreground/30 text-center mt-4">—</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
