import { AlertTriangle, Check, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Sinal } from "./perfData";

interface Props {
  sinais: Sinal[];
  loading: boolean;
}

const TOM = {
  bad: { box: "bg-danger-500/10 text-danger-500", Icon: TriangleAlert },
  warn: { box: "bg-warning-500/12 text-warning-700 dark:text-warning-500", Icon: AlertTriangle },
  ok: { box: "bg-success-500/12 text-success-700 dark:text-success-500", Icon: Check },
} as const;

export function PerfSinais({ sinais, loading }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold text-foreground">
        <AlertTriangle className="h-4 w-4 text-warning-500" strokeWidth={2} />
        Sinais de atenção
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
        ) : (
          sinais.map((s, i) => {
            const { box, Icon } = TOM[s.tom];
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-muted-foreground/40">
                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", box)}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold leading-snug text-foreground">{s.titulo}</span>
                  {s.detalhe && <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{s.detalhe}</span>}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
