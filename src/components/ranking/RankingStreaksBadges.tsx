/**
 * RankingStreaksBadges — Compact streak + achievement display
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Flame, Award, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { ACHIEVEMENTS, getAchievementDef } from "@/lib/gamification";

function getStreakLabel(days: number) {
  if (days >= 10) return { label: "Streak Elite", emoji: "🏆", color: "text-amber-600" };
  if (days >= 5) return { label: "Em Chamas!", emoji: "🔥🔥", color: "text-orange-500" };
  if (days >= 3) return { label: "Sequência!", emoji: "🔥", color: "text-orange-400" };
  return { label: "Iniciando", emoji: "⚡", color: "text-muted-foreground" };
}

export default function RankingStreaksBadges() {
  const { user } = useAuth();

  const { data: streakDays = 0 } = useQuery({
    queryKey: ["ranking-streak", user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      const { data: goals } = await supabase
        .from("corretor_daily_goals")
        .select("data, meta_ligacoes, status")
        .eq("corretor_id", user!.id)
        .gte("data", startDate)
        .order("data", { ascending: false });

      if (!goals || goals.length === 0) return 0;

      const { data: tentativas } = await supabase
        .from("oferta_ativa_tentativas")
        .select("created_at")
        .eq("corretor_id", user!.id)
        .gte("created_at", `${startDate}T00:00:00-03:00`);

      const tentsByDay = new Map<string, number>();
      (tentativas || []).forEach(t => {
        const day = new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        tentsByDay.set(day, (tentsByDay.get(day) || 0) + 1);
      });

      let streak = 0;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      
      for (const goal of goals) {
        const dayTents = tentsByDay.get(goal.data) || 0;
        if (dayTents >= goal.meta_ligacoes) {
          streak++;
        } else if (goal.data !== today) {
          break;
        }
      }

      return streak;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: conquistas = [] } = useQuery({
    queryKey: ["ranking-conquistas", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("corretor_conquistas")
        .select("conquista_id, desbloqueada_em")
        .eq("user_id", user!.id)
        .order("desbloqueada_em", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const unlockedBadges = useMemo(() => {
    return conquistas
      .map(c => getAchievementDef(c.conquista_id))
      .filter(Boolean) as NonNullable<ReturnType<typeof getAchievementDef>>[];
  }, [conquistas]);

  if (streakDays === 0 && unlockedBadges.length === 0) return null;

  const streakInfo = getStreakLabel(streakDays);

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 flex-wrap"
    >
      {/* Streak chip */}
      {streakDays > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <Flame className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
            {streakInfo.emoji} {streakDays} dias
          </span>
          <span className="text-[10px] text-amber-600/70 dark:text-amber-500/70 hidden sm:inline">
            {streakInfo.label}
          </span>
        </div>
      )}

      {/* Badge chips */}
      {unlockedBadges.slice(0, 4).map(badge => (
        <div
          key={badge.id}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-accent border border-border"
          title={badge.description}
        >
          <span className="text-sm">{badge.emoji}</span>
          <span className="text-[10px] font-semibold text-foreground hidden sm:inline">{badge.label}</span>
        </div>
      ))}

      {unlockedBadges.length > 4 && (
        <span className="text-[10px] text-muted-foreground font-medium">
          +{unlockedBadges.length - 4} conquistas
        </span>
      )}
    </motion.div>
  );
}
