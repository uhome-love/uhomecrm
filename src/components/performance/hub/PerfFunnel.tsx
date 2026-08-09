import { Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FunnelStage } from "./perfData";

interface Props {
  stages: FunnelStage[];
  aproveitamento: number;
  escopoLabel: string;
  loading: boolean;
}

function convTone(v: number) {
  return v >= 45 ? "bg-success-500/12 text-success-700 dark:text-success-500"
    : v >= 20 ? "bg-warning-500/14 text-warning-700 dark:text-warning-500"
    : "bg-danger-500/12 text-danger-500";
}

export function PerfFunnel({ stages, aproveitamento, escopoLabel, loading }: Props) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const vazio = stages.every((s) => !s.value);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Filter className="h-4 w-4 text-primary" strokeWidth={2} />
          Funil por etapa
        </span>
        <span className="text-[11.5px] text-muted-foreground">{escopoLabel}</span>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
          </div>
        ) : vazio ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sem movimentação no período.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {stages.map((s) => {
              const w = Math.max((s.value / max) * 100, s.value > 0 ? 7 : 2);
              return (
                <div key={s.key}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                    <span className="font-semibold text-foreground">{s.label}</span>
                    <span className="flex items-center gap-2.5">
                      {s.conv != null && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", convTone(s.conv))}>
                          {s.conv.toFixed(0)}%
                        </span>
                      )}
                      <span className="text-[13.5px] font-extrabold tabular-nums text-foreground">
                        {s.value.toLocaleString("pt-BR")}
                      </span>
                    </span>
                  </div>
                  <div className="h-[26px] overflow-hidden rounded-lg bg-muted">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-primary to-primary/70 transition-[width] duration-500 ease-out"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !vazio && (
          <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-border pt-3 text-[12px] text-muted-foreground">
            <span>Aproveitamento lead → venda</span>
            <b className="text-foreground tabular-nums">{aproveitamento.toFixed(1).replace(".", ",")}%</b>
          </div>
        )}
      </div>
    </Card>
  );
}
