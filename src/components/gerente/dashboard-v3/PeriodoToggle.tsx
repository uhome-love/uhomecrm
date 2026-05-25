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
    <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
