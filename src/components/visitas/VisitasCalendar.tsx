import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_COLORS, STATUS_LABELS, type Visita } from "@/hooks/useVisitas";

interface Props {
  visitas: Visita[];
  onDayClick?: (date: Date) => void;
}

export default function VisitasCalendar({ visitas, onDayClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const result: Date[] = [];
    let d = calStart;
    while (d <= calEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [currentMonth]);

  const visitasByDate = useMemo(() => {
    const map: Record<string, Visita[]> = {};
    for (const v of visitas) {
      const key = v.data_visita;
      if (!map[key]) map[key] = [];
      map[key].push(v);
    }
    return map;
  }, [visitas]);

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-bold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {weekDays.map(wd => (
          <div key={wd} className="bg-muted/50 py-1.5 text-center text-[10px] font-bold text-muted-foreground uppercase">
            {wd}
          </div>
        ))}

        {days.map(day => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayVisitas = visitasByDate[dateKey] || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <div
              key={dateKey}
              className={`bg-card min-h-[70px] p-1 cursor-pointer hover:bg-muted/30 transition-colors ${
                !inMonth ? "opacity-30" : ""
              } ${today ? "ring-2 ring-primary/30 ring-inset" : ""}`}
              onClick={() => onDayClick?.(day)}
            >
              <p className={`text-[10px] font-medium mb-0.5 ${today ? "text-primary font-bold" : "text-foreground"}`}>
                {format(day, "d")}
              </p>
              <div className="space-y-0.5">
                {dayVisitas.slice(0, 3).map(v => (
                  <div key={v.id} className={`text-[8px] leading-tight px-1 py-0.5 rounded truncate border ${STATUS_COLORS[v.status]}`}>
                    {v.hora_visita ? v.hora_visita.slice(0, 5) + " " : ""}{v.nome_cliente}
                  </div>
                ))}
                {dayVisitas.length > 3 && (
                  <p className="text-[8px] text-muted-foreground pl-1">+{dayVisitas.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
