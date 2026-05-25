import { TrendingDown, TrendingUp, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  meta?: number;
  delta?: number | null;
  icon: LucideIcon;
  /** Cor do ícone (semantic token: primary | success | warning | purple) */
  tone?: "primary" | "success" | "warning" | "purple";
  formatValue?: (v: number) => string;
  hideProgress?: boolean;
}

const toneMap = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  purple: "bg-purple-50 text-purple-700",
} as const;

export function SecondaryMetricCard({
  label,
  value,
  meta,
  delta,
  icon: Icon,
  tone = "primary",
  formatValue = (v) => v.toLocaleString("pt-BR"),
  hideProgress,
}: Props) {
  const pct = meta && meta > 0 ? Math.min(100, (value / meta) * 100) : null;
  const DeltaIcon = delta == null ? Minus : delta >= 0 ? TrendingUp : TrendingDown;
  const deltaColor =
    delta == null ? "text-muted-foreground" : delta >= 0 ? "text-success-700" : "text-danger-700";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", deltaColor)}>
          <DeltaIcon className="h-3.5 w-3.5" />
          {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{formatValue(value)}</span>
        {meta != null && meta > 0 && (
          <span className="text-xs text-muted-foreground">/ {formatValue(meta)}</span>
        )}
      </div>

      {!hideProgress && pct != null && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                tone === "primary" && "bg-primary-500",
                tone === "success" && "bg-success-500",
                tone === "warning" && "bg-warning-500",
                tone === "purple" && "bg-purple-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
