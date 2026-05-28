import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface KpiItem {
  label: string;
  value: string;
  /** Tooltip opcional (ex.: valor exato para VGV short) */
  title?: string;
  /** Variação percentual vs período anterior. Positivo verde, negativo vermelho. */
  delta?: number | null;
  /** Sufixo opcional impresso após o valor (ex.: "%"). */
  suffix?: string;
}

interface Props {
  items?: KpiItem[];
  loading?: boolean;
  /** Quantos skeletons mostrar enquanto loading=true. Default 4. */
  skeletonCount?: number;
}

export function KpiRow({ items, loading, skeletonCount = 4 }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="central-card p-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        items.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="central-card p-4" title={it.title}>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {it.label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-foreground">
              {it.value}
              {it.suffix ? (
                <span className="ml-0.5 text-base text-muted-foreground">{it.suffix}</span>
              ) : null}
            </span>
            {typeof it.delta === "number" && Number.isFinite(it.delta) ? (
              <DeltaBadge delta={it.delta} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        positive
          ? "bg-success/10 text-success"
          : "bg-danger-500/10 text-danger-500"
      )}
    >
      {positive ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}
