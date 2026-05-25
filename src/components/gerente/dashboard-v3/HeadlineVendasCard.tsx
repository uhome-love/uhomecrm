import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  vendas: number;
  meta: number;
  vendasQtd: number;
  delta: number | null;
  periodoLabel: string;
}

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function HeadlineVendasCard({ vendas, meta, vendasQtd, delta, periodoLabel }: Props) {
  const pct = meta > 0 ? Math.min(100, (vendas / meta) * 100) : 0;
  const DeltaIcon = delta == null ? Minus : delta >= 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta == null ? "text-white/60" : delta >= 0 ? "text-emerald-200" : "text-rose-200";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 p-6 text-primary-foreground shadow-lg">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80 uppercase tracking-wide">
              Vendas — {periodoLabel}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {vendasQtd} negócio{vendasQtd === 1 ? "" : "s"} assinado{vendasQtd === 1 ? "" : "s"}
            </p>
          </div>
          <div className={cn("flex items-center gap-1 text-sm font-semibold", deltaColor)}>
            <DeltaIcon className="h-4 w-4" />
            {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-4xl font-bold tracking-tight">{fmtBRL(vendas)}</span>
          <span className="text-sm text-white/70">/ meta {fmtBRL(meta)}</span>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-white/70">{pct.toFixed(0)}% da meta</p>
        </div>
      </div>
    </div>
  );
}
