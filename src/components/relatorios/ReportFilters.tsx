import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileDown, Link2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";

const PERIOD_CHIPS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
] as const;

export type PeriodKey = (typeof PERIOD_CHIPS)[number]["key"];

const SEGMENTOS = ["Todos", "MCMV", "Médio-Alto", "Altíssimo", "Investimento"] as const;

interface ReportFiltersProps {
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (r: DateRange | undefined) => void;
  equipe: string;
  onEquipeChange: (v: string) => void;
  corretor: string;
  onCorretorChange: (v: string) => void;
  segmento: string;
  onSegmentoChange: (v: string) => void;
  isAdmin: boolean;
}

export default function ReportFilters({
  period,
  onPeriodChange,
  dateRange,
  onDateRangeChange,
  equipe,
  onEquipeChange,
  corretor,
  onCorretorChange,
  segmento,
  onSegmentoChange,
  isAdmin,
}: ReportFiltersProps) {
  const { toast } = useToast();
  const [calOpen, setCalOpen] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copiado!", description: "URL copiada para a área de transferência." });
  };

  return (
    <div
      className="bg-white px-4 py-3 flex flex-wrap items-center gap-3 border-b"
      style={{ borderBottomWidth: "0.5px", borderColor: "#e5e7eb" }}
    >
      {/* Period chips */}
      <div className="flex items-center gap-1.5">
        {PERIOD_CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => onPeriodChange(chip.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              period === chip.key
                ? "bg-[#EEF2FF] text-[#4F46E5]"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {chip.label}
          </button>
        ))}

        {period === "custom" && (
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <CalendarDays size={13} />
                {dateRange?.from
                  ? `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${dateRange.to ? format(dateRange.to, "dd/MM", { locale: ptBR }) : "..."}`
                  : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(r) => {
                  onDateRangeChange(r);
                  if (r?.to) setCalOpen(false);
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="h-5 w-px bg-border" />

      {/* Equipe select — admin only */}
      {isAdmin && (
        <Select value={equipe} onValueChange={onEquipeChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas equipes</SelectItem>
            {/* Placeholder — will be dynamic */}
          </SelectContent>
        </Select>
      )}

      {/* Corretor select */}
      <Select value={corretor} onValueChange={onCorretorChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Corretor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {/* Placeholder — will be dynamic */}
        </SelectContent>
      </Select>

      {/* Segmento */}
      <Select value={segmento} onValueChange={onSegmentoChange}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Segmento" />
        </SelectTrigger>
        <SelectContent>
          {SEGMENTOS.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled>
          <FileDown size={13} /> Exportar PDF
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={copyLink}>
          🔗 Link
        </Button>
      </div>
    </div>
  );
}
