import { cn } from "@/lib/utils";
import type { PeriodoV3 } from "@/hooks/useDashboardGerenteV3";

interface Props {
  value: PeriodoV3;
  onChange: (v: PeriodoV3) => void;
}

const OPTIONS: { value: PeriodoV3; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
];

export function PeriodoToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex gap-0.5 rounded-xl border border-border bg-muted/70 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-7 px-3.5 text-[12.5px] font-medium rounded-lg transition-all",
            value === opt.value
              ? "bg-card text-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
