import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import type { PulseDesafio } from "@/hooks/usePulse";

interface Props {
  desafio: PulseDesafio;
}

export default function PulseDesafioCard({ desafio }: Props) {
  const [timeLeft, setTimeLeft] = useState("");
  const pct = desafio.meta > 0 ? Math.min(100, Math.round((desafio.progresso_atual / desafio.meta) * 100)) : 0;
  const isCompleted = desafio.status === "concluido" || pct >= 100;

  useEffect(() => {
    const update = () => {
      const diff = new Date(desafio.data_fim).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Encerrado"); return; }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${hrs}h ${mins}min`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [desafio.data_fim]);

  const isUrgent = new Date(desafio.data_fim).getTime() - Date.now() < 2 * 3600000;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl p-4 border-2 ${
        isCompleted
          ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-purple-400/60 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{isCompleted ? "🏆" : "🎯"}</span>
        <span className="text-sm font-bold text-foreground">{desafio.titulo}</span>
      </div>

      {desafio.descricao && (
        <p className="text-xs text-muted-foreground italic mb-3">"{desafio.descricao}"</p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{desafio.progresso_atual}/{desafio.meta}</span>
          <span className={`font-bold ${pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-blue-600"}`}>
            {pct}%
          </span>
        </div>
        <Progress
          value={pct}
          className={`h-2.5 ${pct >= 80 ? "[&>div]:bg-green-500" : pct >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500"}`}
        />
      </div>

      {(desafio.top_contributors || []).length > 0 && (
        <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
          <span>🏅 Top:</span>
          {desafio.top_contributors!.slice(0, 3).map((c, i) => (
            <span key={i} className="font-medium text-foreground">
              {c.nome.split(" ")[0]} ({c.quantidade})
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mt-2 text-[11px]">
        <span>⏱</span>
        <span className={`font-medium ${isUrgent ? "text-red-500 animate-pulse" : "text-muted-foreground"}`}>
          Faltam {timeLeft}
        </span>
      </div>
    </motion.div>
  );
}
