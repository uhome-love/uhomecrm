import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "./Sparkline";

export interface KpiCardData {
  label: string;
  value: string;
  /** Tooltip opcional (ex.: valor exato do VGV abreviado). */
  title?: string;
  icon?: LucideIcon;
  /** Variação % vs período anterior. Positivo verde, negativo vermelho. */
  delta?: number | null;
  /** Sufixo impresso após o valor (ex.: "%"). */
  suffix?: string;
  /** Série para sparkline (opcional). */
  spark?: number[];
  /** Inverte a semântica de cor do delta (ex.: "no-show" subir é ruim). */
  invertDelta?: boolean;
  /** Texto auxiliar abaixo do valor. */
  hint?: string;
}

interface Props {
  items?: KpiCardData[];
  loading?: boolean;
  skeletonCount?: number;
  /** Colunas no breakpoint sm. Default 4. */
  cols?: 2 | 3 | 4;
}

const COLS_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function KpiGrid({ items, loading, skeletonCount = 4, cols = 4 }: Props) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 gap-3", COLS_CLASS[cols])}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="central-kpi p-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="mt-3 h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className={cn("grid grid-cols-2 gap-3", COLS_CLASS[cols])}>
      {items.map((it) => (
        <KpiCard key={it.label} {...it} />
      ))}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  title,
  icon: Icon,
  delta,
  suffix,
  spark,
  invertDelta,
  hint,
}: KpiCardData) {
  return (
    <div className="central-kpi flex flex-col p-4" title={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-2xl leading-none text-foreground sm:text-[26px]">
          {value}
          {suffix ? (
            <span className="ml-0.5 text-base text-muted-foreground">{suffix}</span>
          ) : null}
        </span>
        {typeof delta === "number" && Number.isFinite(delta) ? (
          <DeltaBadge delta={delta} invert={invertDelta} />
        ) : null}
      </div>

      {hint ? <span className="mt-1 text-xs text-muted-foreground">{hint}</span> : null}

      {spark && spark.length >= 2 ? (
        <div className="mt-auto pt-3">
          <Sparkline data={spark} tone={spark[spark.length - 1] >= spark[0] ? "primary" : "danger"} />
        </div>
      ) : null}
    </div>
  );
}

function DeltaBadge({ delta, invert }: { delta: number; invert?: boolean }) {
  const up = delta >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        good ? "bg-success/10 text-success" : "bg-danger-500/10 text-danger-500"
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}
