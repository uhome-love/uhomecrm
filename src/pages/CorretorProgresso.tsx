import { motion } from "framer-motion";
import { Target, Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useMissoesLeads } from "@/hooks/useMissoesLeads";
import { useConquistas } from "@/hooks/useConquistas";
import LevelProgressBar from "@/components/corretor/LevelProgressBar";
import CelebrationOverlay from "@/components/corretor/CelebrationOverlay";
import MissoesDeHoje from "@/components/corretor/MissoesDeHoje";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import RankingGestaoLeads from "@/components/corretor/RankingGestaoLeads";
import { ACHIEVEMENTS, CATEGORY_LABELS, type AchievementCategory } from "@/lib/gamification";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock } from "lucide-react";

export default function CorretorProgresso() {
  const { progress, goals, saveGoals } = useCorretorProgress();
  const { missoes, missaoGeral, ranking, rankingLoading, userId } = useMissoesLeads();
  const { unlocked, isUnlocked, newlyUnlocked, dismissCelebration } = useConquistas();

  const categories: AchievementCategory[] = ["volume", "qualidade", "consistencia", "especial"];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto pb-20">
      <CelebrationOverlay achievement={newlyUnlocked} onDismiss={dismissCelebration} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-2">
        <h1 className="text-2xl font-black text-foreground flex items-center justify-center gap-2">
          <Target className="h-6 w-6 text-primary" /> Progresso do Dia
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Missões, metas, ranking e conquistas</p>
      </motion.div>

      {/* Level + XP */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-primary/10">
          <CardContent className="p-4">
            <LevelProgressBar points={progress.pontos} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Missões + Meta do Dia side by side */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MissoesDeHoje
            missoes={missoes}
            missaoGeral={missaoGeral}
            pontos={progress.pontos}
            todasCompletas={progress.todasMissoesCumpridas}
          />
          <DailyProgressCard
            progress={progress}
            goals={goals}
            saveGoals={saveGoals}
            variant="full"
          />
        </div>
      </motion.div>

      {/* Ranking */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <RankingGestaoLeads ranking={ranking} loading={rankingLoading} userId={userId} />
      </motion.div>

      {/* Conquistas Grid */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-primary/10 overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" /> Conquistas
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {unlocked.length}/{ACHIEVEMENTS.length}
              </span>
            </div>

            <TooltipProvider delayDuration={200}>
              {categories.map((cat) => {
                const catInfo = CATEGORY_LABELS[cat];
                const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
                const catUnlocked = catAchievements.filter(a => isUnlocked(a.id)).length;

                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        {catInfo.emoji} {catInfo.label}
                      </h3>
                      <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">
                        {catUnlocked}/{catAchievements.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {catAchievements.map((ach) => {
                        const achieved = isUnlocked(ach.id);
                        const unlockedData = unlocked.find(u => u.conquista_id === ach.id);

                        return (
                          <Tooltip key={ach.id}>
                            <TooltipTrigger asChild>
                              <div className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-default relative ${
                                achieved
                                  ? "bg-primary/5 border-primary/20 shadow-sm"
                                  : "opacity-40 grayscale bg-muted/30 border-border/40"
                              }`}>
                                <span className="text-2xl mb-1">{achieved ? ach.emoji : "???"}</span>
                                <p className={`text-[11px] font-bold leading-tight ${achieved ? "text-foreground" : "text-muted-foreground"}`}>
                                  {achieved ? ach.label : "???"}
                                </p>
                                {!achieved && <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-muted-foreground/60" />}
                                {ach.special && achieved && (
                                  <Badge className="absolute -top-1.5 -right-1.5 text-[8px] px-1 py-0 h-4 bg-purple-500 text-white border-0">
                                    ESPECIAL
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                              <p className="font-semibold">{ach.label}</p>
                              <p className="text-muted-foreground">{ach.description}</p>
                              {achieved && unlockedData && (
                                <p className="text-primary mt-1 text-[10px]">
                                  ✅ {format(new Date(unlockedData.desbloqueada_em), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                              {!achieved && <p className="text-muted-foreground mt-1">🔒 Bloqueada</p>}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </TooltipProvider>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
