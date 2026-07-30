import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Trilha, Aula } from "@/hooks/useAcademia";
import { gradientOf } from "./trilhaVisual";

interface Props {
  trilha: Trilha;
  aula: Aula;
  percent: number;
  onContinuar: () => void;
  onVerTrilha: () => void;
}

export function AcademiaHero({ trilha, aula, percent, onContinuar, onVerTrilha }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden border border-border min-h-[220px]"
    >
      {trilha.thumbnail_url ? (
        <img src={trilha.thumbnail_url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradientOf(trilha.categoria))} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/20" />

      <div className="relative p-6 sm:p-8 max-w-2xl flex flex-col justify-center min-h-[220px]">
        <span className="w-max inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/20 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white">
          ▶ CONTINUE DE ONDE PAROU
        </span>
        <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white leading-tight">{trilha.titulo}</h2>
        <p className="mt-1.5 text-sm text-white/80">{aula.titulo}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/70">
          {aula.duracao_minutos ? <span>⏱️ {aula.duracao_minutos} min</span> : null}
          {aula.xp_recompensa ? <span>⭐ {aula.xp_recompensa} XP</span> : null}
        </div>
        <div className="mt-3 h-1.5 w-full max-w-xs rounded-full bg-white/25 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="mt-1 text-[11px] text-white/70">{percent}% concluído</span>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onContinuar} className="gap-1.5">
            <Play className="h-4 w-4" /> Continuar aula
          </Button>
          <Button onClick={onVerTrilha} variant="outline" className="bg-white/10 text-white border-white/25 hover:bg-white/20 hover:text-white">
            Ver módulo completo
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
