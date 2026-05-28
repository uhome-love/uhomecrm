import { TrendingDown, TrendingUp, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  vgv: number;
  count: number;
  meta: number;
  deltaPct: number | null;
}

const formatVgv = (v: number) => fmtMoney(v, "short");

export function V4VendasHeroCard({ vgv, count, meta, deltaPct }: Props) {
  const pct = meta > 0 ? Math.min(100, (vgv / meta) * 100) : null;
  const DeltaIcon = deltaPct == null ? Minus : deltaPct >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-5 shadow-md text-white">
      {/* glow decorativo */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-white/90">
          <DeltaIcon className="h-3.5 w-3.5" />
          {deltaPct == null ? "—" : `${deltaPct > 0 ? "+" : ""}${deltaPct}%`}
          <span className="text-white/60 ml-1">vs mês ant.</span>
        </div>
      </div>

      <p className="relative mt-3 text-sm text-white/80">Vendas · Este mês</p>
      <div className="relative mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight">{formatVgv(vgv)}</span>
        {meta > 0 && <span className="text-xs text-white/70">/ {formatVgv(meta)}</span>}
      </div>
      <p className="relative mt-0.5 text-xs text-white/80">
        {count} {count === 1 ? "venda assinada" : "vendas assinadas"}
      </p>

      {pct != null && (
        <div className="relative mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className={cn("h-full rounded-full bg-white transition-all duration-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
