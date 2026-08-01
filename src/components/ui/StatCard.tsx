import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: { value: string; direction: "up" | "down" };
  accent?: boolean;
  active?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, value, sub, delta, accent, active, onClick }: StatCardProps) {
  const className = cn(
    "rounded-[12px] border border-border bg-card px-4 py-3.5 flex flex-col gap-1.5 text-left transition-all",
    accent && "bg-primary/[0.04] border-primary/30",
    active && "ring-2 ring-primary/30 bg-primary/[0.02]",
    onClick && "cursor-pointer hover:border-neutral-300 dark:hover:border-white/15"
  );

  const inner = (
    <>
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </span>
      {delta ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11.5px] font-semibold px-1.5 py-0.5 rounded-full w-fit",
            delta.direction === "up"
              ? "bg-success-500/10 text-success-500"
              : "bg-danger-500/10 text-danger-500"
          )}
        >
          {delta.direction === "up" ? "▲" : "▼"} {delta.value}
        </span>
      ) : (
        sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export default StatCard;
