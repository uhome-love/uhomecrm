/** Placar do dia em uma linha: ligações / aproveitados / visitas contra a meta do corretor. Comemora ao bater cada meta. */
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Phone, Handshake, Home } from "lucide-react";
import { toast } from "sonner";
import { useCorretorDailyStats, useCorretorDailyGoals } from "@/hooks/useCorretorDailyStats";
import { pct } from "@/lib/arenaLigacoes";
import { getCelebrationEnabled, playSoundFanfare } from "@/lib/celebrations";
import { cn } from "@/lib/utils";
import { ARENA_MINIMO } from "@/lib/arenaLigacoes";

export function usePlacarDia() {
  const { stats, isLoading } = useCorretorDailyStats();
  const { metaEfetiva } = useCorretorDailyGoals();
  const metas = {
    ligacoes: Math.max(ARENA_MINIMO.ligacoes, metaEfetiva.meta_ligacoes),
    aproveitados: Math.max(ARENA_MINIMO.aproveitados, metaEfetiva.meta_aproveitados),
    visitas: Math.max(ARENA_MINIMO.visitas, metaEfetiva.meta_visitas_marcadas),
  };
  const valores = { ligacoes: stats.ligacoes, aproveitados: stats.aproveitados, visitas: stats.visitas_marcadas };
  return { metas, valores, isLoading };
}

const ITENS = [
  { k: "ligacoes", icon: Phone, label: "Ligações", meta: "meta de ligações" },
  { k: "aproveitados", icon: Handshake, label: "Aproveitados", meta: "meta de aproveitados" },
  { k: "visitas", icon: Home, label: "Visitas", meta: "meta de visitas" },
] as const;

export default function PlacarCompacto({ variante = "linha" }: { variante?: "linha" | "barras" }) {
  const { metas, valores, isLoading } = usePlacarDia();
  const antes = useRef<typeof valores | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const a = antes.current;
    if (a) {
      const batidas = ITENS.filter((i) => a[i.k] < metas[i.k] && valores[i.k] >= metas[i.k]);
      if (batidas.length) {
        batidas.forEach((i) => toast.success(`Você bateu a ${i.meta}! 🎉`));
        if (getCelebrationEnabled()) playSoundFanfare();
      }
    }
    antes.current = valores;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, valores.ligacoes, valores.aproveitados, valores.visitas]);

  if (variante === "linha") {
    return (
      <div className="flex items-center gap-3 text-sm sm:gap-5" aria-label="Placar de hoje">
        {ITENS.map(({ k, icon: Icon, label }) => {
          const ok = valores[k] >= metas[k];
          return (
            <span key={k} className={cn("flex items-center gap-1 tabular-nums", ok ? "text-success-600" : "text-foreground")} title={label}>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <motion.b key={valores[k]} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="inline-block">{isLoading ? "…" : valores[k]}</motion.b>
              <span className="text-muted-foreground">/{metas[k]}</span>
              <span className="sr-only">{label}</span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-5">
      {ITENS.map(({ k, label }) => {
        const ok = valores[k] >= metas[k];
        return (
          <div key={k} className="min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <span className="truncate text-xs text-muted-foreground">{label}</span>
              {ok && <span className="text-xs" aria-label="meta batida">✅</span>}
            </div>
            <div className="mt-0.5 tabular-nums">
              <motion.span key={valores[k]} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="inline-block text-xl font-bold">{isLoading ? "…" : valores[k]}</motion.span>
              <span className="text-sm text-muted-foreground">/{metas[k]}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div className={cn("h-full rounded-full", ok ? "bg-success" : "bg-primary")} initial={false} animate={{ width: `${pct(valores[k], metas[k])}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
