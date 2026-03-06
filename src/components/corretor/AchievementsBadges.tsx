import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CorretorProgress } from "@/hooks/useCorretorProgress";

interface Achievement {
  id: string;
  emoji: string;
  label: string;
  description: string;
  unlocked: boolean;
}

function getAchievements(progress: CorretorProgress, streak: number): Achievement[] {
  return [
    {
      id: "first_call",
      emoji: "📞",
      label: "Primeira Ligação",
      description: "Fez a primeira tentativa do dia",
      unlocked: progress.tentativas >= 1,
    },
    {
      id: "ten_calls",
      emoji: "🔟",
      label: "Dez na Conta",
      description: "10 tentativas no dia",
      unlocked: progress.tentativas >= 10,
    },
    {
      id: "first_aproveitado",
      emoji: "🎯",
      label: "Primeiro Aproveitado",
      description: "Conquistou o primeiro interessado do dia",
      unlocked: progress.aproveitados >= 1,
    },
    {
      id: "mission_calls",
      emoji: "🔥",
      label: "Meta Tentativas",
      description: "Bateu a meta de tentativas",
      unlocked: progress.missaoCumprida,
    },
    {
      id: "mission_aproveitados",
      emoji: "⭐",
      label: "Meta Aproveitados",
      description: "Bateu a meta de aproveitados",
      unlocked: progress.missaoAproveitados,
    },
    {
      id: "mission_visitas",
      emoji: "📅",
      label: "Meta Visitas",
      description: "Bateu a meta de visitas marcadas",
      unlocked: progress.missaoVisitas,
    },
    {
      id: "all_missions",
      emoji: "🏆",
      label: "Missão Completa",
      description: "Todas as metas do dia batidas!",
      unlocked: progress.todasMissoesCumpridas,
    },
    {
      id: "streak_3",
      emoji: "🔥",
      label: "3 Dias Seguidos",
      description: "Streak de 3 dias consecutivos",
      unlocked: streak >= 3,
    },
    {
      id: "streak_7",
      emoji: "💎",
      label: "Semana Perfeita",
      description: "Streak de 7 dias consecutivos",
      unlocked: streak >= 7,
    },
    {
      id: "high_rate",
      emoji: "📈",
      label: "Taxa 30%+",
      description: "Taxa de aproveitamento acima de 30%",
      unlocked: progress.taxaAproveitamento >= 30 && progress.tentativas >= 5,
    },
  ];
}

interface Props {
  progress: CorretorProgress;
  streak: number;
}

export default function AchievementsBadges({ progress, streak }: Props) {
  const achievements = getAchievements(progress, streak);
  const unlocked = achievements.filter(a => a.unlocked).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Conquistas do Dia
        </p>
        <p className="text-[10px] text-muted-foreground">
          {unlocked}/{achievements.length}
        </p>
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-1.5">
          {achievements.map((a, i) => (
            <Tooltip key={a.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={a.unlocked ? { scale: 0.5 } : {}}
                  animate={a.unlocked ? { scale: 1 } : {}}
                  transition={{ type: "spring", delay: i * 0.05 }}
                  className={`
                    flex items-center justify-center h-8 w-8 rounded-lg text-sm
                    transition-all cursor-default
                    ${a.unlocked
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : "bg-muted/50 border border-border opacity-30 grayscale"
                    }
                  `}
                >
                  {a.emoji}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[180px]">
                <p className="font-semibold">{a.label}</p>
                <p className="text-muted-foreground">{a.description}</p>
                {!a.unlocked && <p className="text-primary mt-0.5">🔒 Bloqueado</p>}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
