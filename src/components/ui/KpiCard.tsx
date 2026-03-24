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
  default:   "text-[#0a0a0a] dark:text-[#fafafa]",
  highlight: "text-[#4F46E5] dark:text-[#818cf8]",
  success:   "text-[#10b981] dark:text-[#34d399]",
  warning:   "text-[#f59e0b] dark:text-[#fbbf24]",
  danger:    "text-[#ef4444] dark:text-[#f87171]",
};

const TREND_COLORS: Record<TrendDirection, string> = {
  up:      "text-[#10b981] dark:text-[#34d399]",
  down:    "text-[#ef4444] dark:text-[#f87171]",
  neutral: "text-[#a1a1aa]",
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
        "bg-[#f7f7fb] dark:bg-white/[0.04]",
        "border border-[#e8e8f0] dark:border-white/[0.07] shadow-none",
        "border-l-[3px] border-l-[#4F46E5]",
        "rounded-[14px] p-4 pl-4",
        "flex flex-col gap-2",
        onClick && "cursor-pointer hover:border-[#e0e0e0] dark:hover:border-white/[0.12] hover:border-l-[#4338CA] transition-colors",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#a1a1aa] tracking-[0.01em] truncate">
          {label}
        </span>
        {icon && (
          <span className="text-[#a1a1aa] flex-shrink-0">
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
            <span className="text-[11px] text-[#d4d4d8] dark:text-[#3f3f46] truncate">
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