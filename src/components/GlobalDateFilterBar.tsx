import { useState } from "react";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDateFilter, type GlobalPeriod } from "@/contexts/DateFilterContext";
import { cn } from "@/lib/utils";

const PERIODS: { key: GlobalPeriod; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "ultimos_30d", label: "30 dias" },
];

interface Props {
  /** Visual variant: "header" for dark hero sections, "inline" for cards */
  variant?: "header" | "inline";
  className?: string;
}

export default function GlobalDateFilterBar({ variant = "inline", className }: Props) {
  const { period, setPeriod, setCustomRange, range } = useDateFilter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isHeader = variant === "header";

  const handleApply = () => {
    if (from && to) {
      setCustomRange({ start: from, end: to });
      setOpen(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 flex-wrap mb-4", className)}>
      {PERIODS.map(p => (
        <button
          key={p.key}
          onClick={() => setPeriod(p.key)}
          className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[7px] transition-all",
            period === p.key
              ? "bg-[#4F46E5] text-white"
              : "text-[#71717a] hover:text-[#0a0a0a] hover:bg-[#e8e8f0] dark:hover:text-white dark:hover:bg-white/[0.08]"
          )}
        >
          {p.label}
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "px-3 py-1.5 text-[13px] font-medium rounded-[7px] transition-all flex items-center gap-1.5",
              period === "custom"
                ? "bg-[#4F46E5] text-white"
                : "text-[#71717a] hover:text-[#0a0a0a] hover:bg-[#e8e8f0] dark:hover:text-white dark:hover:bg-white/[0.08]"
            )}
          >
            <CalendarRange className="h-3 w-3" />
            {period === "custom"
              ? (() => {
                  try {
                    return `${format(new Date(range.start + "T12:00:00"), "dd/MM")} — ${format(new Date(range.end + "T12:00:00"), "dd/MM")}`;
                  } catch { return "Personalizado"; }
                })()
              : "Personalizado"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Selecione o período</p>
            <div className="flex gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">De</label>
                <Input
                  type="date"
                  className="h-8 text-xs w-36"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Até</label>
                <Input
                  type="date"
                  className="h-8 text-xs w-36"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              disabled={!from || !to}
              onClick={handleApply}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
