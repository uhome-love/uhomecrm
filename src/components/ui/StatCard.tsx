import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONE_VALUE: Record<StatTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  success: "text-success-500",
  warning: "text-warning-500",
  danger: "text-danger-500",
};

const TONE_BORDER: Record<StatTone, string> = {
  neutral: "",
  primary: "border-l-[3px] border-l-primary",
  success: "border-l-[3px] border-l-success-500",
  warning: "border-l-[3px] border-l-warning-500",
  danger: "border-l-[3px] border-l-danger-500",
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: ReactNode;
  delta?: number;
  tone?: StatTone;
  accent?: boolean;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  tone = "neutral",
  accent,
  active,
  onClick,
  className,
}: StatCardProps) {
  const cardClass = cn(
    "bg-card border border-border rounded-[12px] p-3 text-left transition-all",
    TONE_BORDER[tone],
    accent && "bg-primary/[0.03]",
    onClick && "cursor-pointer hover:border-neutral-300 dark:hover:border-white/15",
    active && "ring-2 ring-primary/30",
    className
  );

  const inner = (
    <>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "text-[22px] font-[800] leading-none mt-1 tracking-[-0.5px] tabular-nums",
          TONE_VALUE[tone]
        )}
      >
        {value}
      </p>
      {(sub || delta !== undefined) && (
        <div className="flex items-center gap-1.5 mt-1">
          {delta !== undefined && (
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                delta >= 0 ? "text-success-500" : "text-danger-500"
              )}
            >
              {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          )}
          {sub && <span className="text-[11px] text-muted-foreground truncate">{sub}</span>}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" aria-pressed={!!active} onClick={onClick} className={cardClass}>
        {inner}
      </button>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}

export default StatCard;
