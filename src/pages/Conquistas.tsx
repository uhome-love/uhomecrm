import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConquistas } from "@/hooks/useConquistas";
import { ACHIEVEMENTS, CATEGORY_LABELS, type AchievementCategory } from "@/lib/gamification";
import LevelProgressBar from "@/components/corretor/LevelProgressBar";
import CelebrationOverlay from "@/components/corretor/CelebrationOverlay";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { Trophy, Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Conquistas() {
  const { unlocked, isUnlocked, newlyUnlocked, dismissCelebration } = useConquistas();
  const { progress } = useCorretorProgress();

  const categories: AchievementCategory[] = ["volume", "qualidade", "consistencia", "especial"];
  const totalUnlocked = unlocked.length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <CelebrationOverlay achievement={newlyUnlocked} onDismiss={dismissCelebration} />

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Conquistas
        </h1>
        <p className="text-sm text-muted-foreground">
          {totalUnlocked} de {ACHIEVEMENTS.length} desbloqueadas
        </p>
      </div>

      {/* Level Progress */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/10">
          <CardContent className="p-4">
            <LevelProgressBar points={progress.pontos} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Achievement Categories */}
      <TooltipProvider delayDuration={200}>
        {categories.map((cat, ci) => {
          const catInfo = CATEGORY_LABELS[cat];
          const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);

          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.08 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>{catInfo.emoji}</span> {catInfo.label}
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {catAchievements.filter(a => isUnlocked(a.id)).length}/{catAchievements.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {catAchievements.map((ach, i) => {
                      const achieved = isUnlocked(ach.id);
                      const unlockedData = unlocked.find(u => u.conquista_id === ach.id);

                      return (
                        <Tooltip key={ach.id}>
                          <TooltipTrigger asChild>
                            <motion.div
                              initial={achieved ? { scale: 0.8 } : {}}
                              animate={achieved ? { scale: 1 } : {}}
                              transition={{ type: "spring", delay: i * 0.03 }}
                              className={`
                                relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-default
                                ${achieved
                                  ? "bg-primary/5 border-primary/20 shadow-sm"
                                  : "bg-muted/30 border-border/50 opacity-50 grayscale"
                                }
                              `}
                            >
                              <span className="text-2xl mb-1">{ach.emoji}</span>
                              <p className="text-[11px] font-bold text-foreground leading-tight">{ach.label}</p>
                              {!achieved && (
                                <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-muted-foreground/40" />
                              )}
                              {ach.special && achieved && (
                                <Badge className="absolute -top-1.5 -right-1.5 text-[8px] px-1 py-0 h-4 bg-purple-500 text-white border-0">
                                  ESPECIAL
                                </Badge>
                              )}
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                            <p className="font-semibold">{ach.label}</p>
                            <p className="text-muted-foreground">{ach.description}</p>
                            {achieved && unlockedData && (
                              <p className="text-primary mt-1 text-[10px]">
                                ✅ Desbloqueada em {format(new Date(unlockedData.desbloqueada_em), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            )}
                            {!achieved && <p className="text-muted-foreground mt-1">🔒 Bloqueada</p>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
