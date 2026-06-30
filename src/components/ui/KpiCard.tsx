import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type TrendDirection = "up" | "down" | "neutral";
type KpiVariant     = "default" | "highlight" | "success" | "warning" | "danger";

interface KpiCardProps {
  label:      string;
  value:      string | number;
  hint?:      string;
  icon?:      ReactNode;
  trend?:     {
    direction: TrendDirection;
    value:     string;
  };
  variant?:   KpiVariant;
  onClick?:   () => void;
  className?: string;
}

const VALUE_COLORS: Record<KpiVariant, string> = {
  default:   "text-foreground",
  highlight: "text-primary",
  success:   "text-success-500",
  warning:   "text-warning-500",
  danger:    "text-danger-500",
};

const TREND_COLORS: Record<TrendDirection, string> = {
  up:      "text-success-500",
  down:    "text-danger-500",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  hint,
  icon,
  trend,
  variant = "default",
  onClick,
  className,
}: KpiCardProps) {
  const TrendIcon =
    trend?.direction === "up"   ? TrendingUp   :
    trend?.direction === "down" ? TrendingDown :
    Minus;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card dark:bg-card",
        "border border-border shadow-none",
        "border-l-[3px] border-l-primary",
        "rounded-[14px] p-4 pl-4",
        "flex flex-col gap-2",
        onClick && "cursor-pointer hover:border-primary/30 hover:border-l-primary transition-colors",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground tracking-[0.01em] truncate">
          {label}
        </span>
        {icon && (
          <span className="text-muted-foreground flex-shrink-0">
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "text-[26px] font-[800] leading-none tracking-[-1px]",
          VALUE_COLORS[variant]
        )}
      >
        {value}
      </div>
      {(hint || trend) && (
        <div className="flex items-center justify-between gap-2 mt-auto">
          {hint && (
            <span className="text-[11px] text-muted-foreground/70 truncate">
              {hint}
            </span>
          )}
          {trend && (
            <div className={cn("flex items-center gap-1 flex-shrink-0", TREND_COLORS[trend.direction])}>
              <TrendIcon size={11} strokeWidth={2} />
              <span className="text-[11px] font-semibold">{trend.value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface KpiGridProps {
  children:   ReactNode;
  cols?:      2 | 3 | 4 | 5;
  className?: string;
}

export function KpiGrid({ children, cols = 4, className }: KpiGridProps) {
  const colsClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5",
  }[cols];

  return (
    <div className={cn("grid gap-3", colsClass, className)}>
      {children}
    </div>
  );
}