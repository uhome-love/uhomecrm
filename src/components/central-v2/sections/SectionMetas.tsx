import { Target } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { SectionHeading } from "@/components/central-v2/shared/SectionHeading";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface MetricRow {
  id?: string;
  label?: string;
  formato?: "moeda" | "numero";
  meta?: number;
  realizado?: number;
  pct?: number | null;
}

function fmtVal(v: number | null | undefined, formato?: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (formato === "moeda") return fmtMoney(v, "short");
  return Math.round(v).toLocaleString("pt-BR");
}

function barColor(pct: number | null | undefined): string {
  if (pct == null) return "bg-muted-foreground/40";
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-primary";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function MetaCard({ row }: { row: MetricRow }) {
  const pct = row.pct ?? null;
  const width = pct == null ? 0 : Math.min(pct, 100);
  const semMeta = !row.meta || row.meta <= 0;

  return (
    <div className="central-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{row.label}</span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            pct == null
              ? "bg-muted text-muted-foreground"
              : pct >= 100
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : pct >= 70
                  ? "bg-primary/15 text-primary"
                  : pct >= 40
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
          )}
        >
          {pct == null ? "s/ meta" : `${pct.toFixed(0)}%`}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl leading-none text-foreground">
          {fmtVal(row.realizado, row.formato)}
        </span>
        <span className="text-sm text-muted-foreground">
          / {semMeta ? "—" : fmtVal(row.meta, row.formato)}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor(pct))}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function SectionMetas({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;

  const metricas = safeGet<MetricRow[]>(data ?? {}, "metricas", "Metas metricas") ?? [];
  const temMetas = safeGet<boolean>(data ?? {}, "tem_metas", "Metas tem_metas");

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        icon={Target}
        title="Metas vs. Realizado"
        subtitle="Atingimento das metas mensais cadastradas no período selecionado"
      />

      {query.error ? (
        <SectionError query={query} label="Metas vs. Realizado" />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="central-card p-4">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="mb-3 h-7 w-28" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : temMetas === false ? (
        <div className="central-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma meta cadastrada para o período selecionado.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {metricas.map((m) => (
            <MetaCard key={m.id ?? m.label} row={m} />
          ))}
        </div>
      )}
    </section>
  );
}
