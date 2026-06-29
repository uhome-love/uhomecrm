import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface FunnelStage {
  label: string;
  value: number;
  /** Texto de valor já formatado (opcional, default = value). */
  display?: string;
}

interface Props {
  title?: string;
  stages: FunnelStage[];
  loading?: boolean;
  emptyLabel?: string;
}

/**
 * Funil de conversão em barras horizontais proporcionais ao topo do funil.
 * Mostra a taxa de conversão entre etapas consecutivas.
 */
export function FunnelChart({ title, stages, loading, emptyLabel = "Sem dados no período." }: Props) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const allZero = stages.every((s) => !s.value);

  return (
    <div className="central-card overflow-hidden">
      {title ? (
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          {title}
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5 p-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : allZero ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          stages.map((s, i) => {
            const pct = Math.max((s.value / max) * 100, s.value > 0 ? 6 : 0);
            const prev = i > 0 ? stages[i - 1].value : null;
            const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
            return (
              <div key={s.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="flex items-center gap-2">
                    {conv != null ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          conv >= 50
                            ? "bg-success/10 text-success"
                            : conv >= 20
                              ? "bg-warning-500/10 text-warning-600"
                              : "bg-danger-500/10 text-danger-500"
                        )}
                      >
                        {conv.toFixed(0)}%
                      </span>
                    ) : null}
                    <span className="font-semibold text-foreground">{s.display ?? s.value.toLocaleString("pt-BR")}</span>
                  </span>
                </div>
                <div className="h-7 w-full overflow-hidden rounded-lg bg-muted/50">
                  <div
                    className="flex h-full items-center rounded-lg bg-gradient-to-r from-primary to-primary/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
