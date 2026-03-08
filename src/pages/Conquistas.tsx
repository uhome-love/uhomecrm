import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConquistas } from "@/hooks/useConquistas";
import { ACHIEVEMENTS, CATEGORY_LABELS, type AchievementCategory } from "@/lib/gamification";
import LevelProgressBar from "@/components/corretor/LevelProgressBar";
import CelebrationOverlay from "@/components/corretor/CelebrationOverlay";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ImmersiveScreen, { ImmersiveLabel } from "@/components/immersive/ImmersiveScreen";

export default function Conquistas() {
  const { unlocked, isUnlocked, newlyUnlocked, dismissCelebration } = useConquistas();
  const { progress } = useCorretorProgress();

  const categories: AchievementCategory[] = ["volume", "qualidade", "consistencia", "especial"];
  const totalUnlocked = unlocked.length;

  // Map categories to thematic emojis for immersive display
  const categoryIcons: Record<AchievementCategory, string> = {
    volume: "🔥",
    qualidade: "⭐",
    consistencia: "🔥",
    especial: "💎",
  };

  return (
    <ImmersiveScreen animate={false} className="min-h-screen">
      <CelebrationOverlay achievement={newlyUnlocked} onDismiss={dismissCelebration} />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-4"
        >
          <ImmersiveLabel>SUAS CONQUISTAS</ImmersiveLabel>
          <p className="text-sm text-neutral-400 mt-2">
            {totalUnlocked} de {ACHIEVEMENTS.length} desbloqueadas
          </p>
        </motion.div>

        {/* Level Progress */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4"
        >
          <LevelProgressBar points={progress.pontos} />
        </motion.div>

        {/* Achievement Categories */}
        <TooltipProvider delayDuration={200}>
          {categories.map((cat, ci) => {
            const catInfo = CATEGORY_LABELS[cat];
            const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
            const catUnlocked = catAchievements.filter(a => isUnlocked(a.id)).length;

            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + ci * 0.08 }}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{catInfo.emoji}</span> {catInfo.label}
                  </h3>
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {catUnlocked}/{catAchievements.length}
                  </span>
                </div>
                <div className="p-4">
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
                                  ? "bg-[#60A5FA]/10 border-[#60A5FA]/25 shadow-[0_0_20px_rgba(96,165,250,0.15)]"
                                  : "bg-white/3 border-white/8 opacity-40 grayscale"
                                }
                              `}
                            >
                              <span className="text-2xl mb-1">{achieved ? ach.emoji : "???"}</span>
                              <p className={`text-[11px] font-bold leading-tight ${achieved ? "text-white" : "text-neutral-500"}`}>
                                {achieved ? ach.label : "???"}
                              </p>
                              {!achieved && (
                                <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-neutral-600" />
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
                </div>
              </motion.div>
            );
          })}
        </TooltipProvider>
      </div>
    </ImmersiveScreen>
  );
}
