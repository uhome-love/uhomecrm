import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "success" | "muted";
  progress?: number; // 0-100
  barClass?: string;
  loading?: boolean;
}

export default function PerfKpiCard({ label, value, hint, hintTone = "muted", progress = 0, barClass = "bg-primary", loading }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 transition-colors hover:border-primary/30">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2 mt-2">
        <h2 className="text-2xl font-bold text-foreground tabular-nums">
          {loading ? <span className="inline-block h-7 w-24 rounded bg-muted animate-pulse" /> : value}
        </h2>
        {hint && !loading && (
          <span className={cn("text-xs font-medium", hintTone === "success" ? "text-success" : "text-muted-foreground")}>{hint}</span>
        )}
      </div>
      <div className="w-full bg-muted h-1.5 rounded-full mt-4 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", barClass)} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
    </div>
  );
}
