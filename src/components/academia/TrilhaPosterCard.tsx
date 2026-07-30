import { motion } from "framer-motion";
import { Play, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Trilha } from "@/hooks/useAcademia";
import { gradientOf, iconOf, isNova } from "./trilhaVisual";

interface Props {
  trilha: Trilha;
  progress: { total: number; completed: number; percent: number; started: boolean };
  onClick: () => void;
}

/** Poster 2:3 card (Netflix / Hotmart style) */
export function TrilhaPosterCard({ trilha, progress, onClick }: Props) {
  const gradient = gradientOf(trilha.categoria);
  const icon = iconOf(trilha.categoria);
  const capa = trilha.thumbnail_url;
  const concluida = progress.percent === 100;

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03 }}
      className={cn(
        "group relative text-left rounded-xl overflow-hidden shrink-0",
        "w-[170px] aspect-[2/3] border border-border/60 hover:border-primary/50",
        "shadow-md hover:shadow-xl transition-shadow"
      )}
    >
      {capa ? (
        <img src={capa} alt={`Capa da trilha ${trilha.titulo}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

      {/* Badges */}
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
        {concluida && <Badge className="bg-emerald-500/90 text-emerald-950 border-0 text-[10px]">✅ Concluída</Badge>}
        {!concluida && progress.started && (
          <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">{progress.percent}%</Badge>
        )}
        {!progress.started && isNova(trilha.created_at) && (
          <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">NOVO</Badge>
        )}
      </div>

      <div className="relative h-full flex flex-col justify-between p-3">
        {!capa && <span className="text-3xl drop-shadow-lg">{icon}</span>}
        <div className="mt-auto space-y-1.5">
          <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{trilha.titulo}</h3>
          <div className="flex items-center gap-2 text-[11px] text-white/75">
            <span>{progress.total} aulas</span>
            {trilha.xp_total ? <span>⭐ {trilha.xp_total} XP</span> : null}
          </div>
          {progress.started && (
            <div className="h-1 w-full rounded-full bg-white/25 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress.percent}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
        <div className="h-10 w-10 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
          <Play className="h-4 w-4 text-white ml-0.5" />
        </div>
      </div>
    </motion.button>
  );
}

export function ComingSoonPosterCard({ titulo, icon, gradient }: { titulo: string; icon: string; gradient: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden shrink-0 w-[170px] aspect-[2/3] opacity-50 cursor-not-allowed border border-border/40">
      <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative h-full flex flex-col items-center justify-center gap-2 p-3 text-center">
        <span className="text-3xl opacity-60">{icon}</span>
        <h3 className="text-xs font-bold text-white/80">{titulo}</h3>
        <Badge className="bg-white/10 text-white/70 border-white/10 gap-1 text-[10px]">
          <Lock className="h-3 w-3" /> Em breve
        </Badge>
      </div>
    </div>
  );
}
