import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PeriodMode = "hoje" | "semana" | "custom";

export interface PeriodRange {
  /** Início do intervalo (ISO UTC). */
  from: string;
  /** Fim do intervalo (ISO UTC). */
  to: string;
  mode: PeriodMode;
  /** Rótulo curto para exibição. */
  label: string;
}

/** Início do dia BRT (00:00 -03:00) para uma data em UTC. */
function startOfDayBRT(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
  // Se o instante calculado ficou no futuro (madrugada UTC), volta um dia.
  if (x.getTime() > d.getTime()) x.setUTCDate(x.getUTCDate() - 1);
  return x;
}

/** Fim do dia BRT (23:59:59.999 -03:00) para uma data em UTC. */
function endOfDayBRT(d: Date): Date {
  const start = startOfDayBRT(d);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return end;
}

export function buildRange(mode: PeriodMode, customDate?: Date): PeriodRange {
  const now = new Date();
  if (mode === "semana") {
    const start = startOfDayBRT(now);
    start.setUTCDate(start.getUTCDate() - 6); // últimos 7 dias (hoje incluso)
    return { from: start.toISOString(), to: now.toISOString(), mode, label: "Últimos 7 dias" };
  }
  if (mode === "custom" && customDate) {
    return {
      from: startOfDayBRT(customDate).toISOString(),
      to: endOfDayBRT(customDate).toISOString(),
      mode,
      label: format(customDate, "dd/MM/yyyy", { locale: ptBR }),
    };
  }
  // hoje (default)
  return { from: startOfDayBRT(now).toISOString(), to: now.toISOString(), mode: "hoje", label: "Hoje" };
}

export default function PeriodFilter({
  value,
  onChange,
}: {
  value: PeriodRange;
  onChange: (r: PeriodRange) => void;
}) {
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  const btn = (mode: PeriodMode, label: string) => (
    <Button
      key={mode}
      size="sm"
      variant={value.mode === mode ? "default" : "outline"}
      className="h-8 text-xs"
      onClick={() => onChange(buildRange(mode))}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Período:</span>
      {btn("hoje", "Hoje")}
      {btn("semana", "Semana")}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={value.mode === "custom" ? "default" : "outline"}
            className={cn("h-8 text-xs justify-start font-normal", value.mode !== "custom" && "text-muted-foreground")}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            {value.mode === "custom" ? value.label : "Data personalizada"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={customDate}
            onSelect={(d) => {
              if (!d) return;
              setCustomDate(d);
              onChange(buildRange("custom", d));
            }}
            disabled={(d) => d > new Date()}
            initialFocus
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
