import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface Props {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "success" | "muted";
  progress?: number; // 0-100
  barClass?: string;
  loading?: boolean;
  onClick?: () => void;
}

export default function PerfKpiCard({
  label,
  value,
  hint,
  hintTone = "muted",
  progress = 0,
  barClass = "bg-primary",
  loading,
  onClick,
}: Props) {
  const Root = onClick ? "button" : "div";

  return (
    <Root
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl p-5 text-left w-full transition-colors hover:border-primary/30",
        onClick && "cursor-pointer group"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {onClick && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />}
      </div>

      <h2 className="text-2xl font-bold text-foreground tabular-nums mt-2 whitespace-nowrap">
        {loading ? <span className="inline-block h-7 w-24 rounded bg-muted animate-pulse" /> : value}
      </h2>

      <p className={cn("text-xs font-medium mt-1 min-h-[1rem]", hintTone === "success" ? "text-success" : "text-muted-foreground")}>
        {!loading && hint ? hint : ""}
      </p>

      <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClass)}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </Root>
  );
}
