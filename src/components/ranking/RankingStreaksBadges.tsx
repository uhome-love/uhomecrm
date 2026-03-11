/**
 * RankingStreaksBadges — Displays streak and achievement badges for the current user
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Flame, Award } from "lucide-react";
import { motion } from "framer-motion";

interface StreakData {
  streak: number;
  label: string;
  emoji: string;
}

const BADGES = [
  { id: "rei_prospeccao", emoji: "📞", label: "Rei da Prospecção", desc: "Maior número de ligações no período" },
  { id: "mestre_visitas", emoji: "🏡", label: "Mestre das Visitas", desc: "Maior taxa de visitas marcadas" },
  { id: "fechador_mes", emoji: "💰", label: "Fechador do Mês", desc: "Maior VGV assinado no mês" },
  { id: "maior_evolucao", emoji: "🚀", label: "Maior Evolução", desc: "Maior crescimento vs período anterior" },
];

function getStreakInfo(days: number): StreakData {
  if (days >= 10) return { streak: days, label: "Streak Elite", emoji: "🏆" };
  if (days >= 5) return { streak: days, label: "Em Chamas!", emoji: "🔥🔥" };
  if (days >= 3) return { streak: days, label: "Sequência!", emoji: "🔥" };
  return { streak: days, label: "Iniciando", emoji: "⚡" };
}

export default function RankingStreaksBadges() {
  const { user } = useAuth();

  // Compute streak from corretor_daily_goals (days in a row with goals met)
  const { data: streakDays = 0 } = useQuery({
    queryKey: ["ranking-streak", user?.id],
    queryFn: async () => {
      // Get last 30 days of daily goals to compute streak
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

      // Also get daily stats to check if meta was hit
      const { data: tentativas } = await supabase
        .from("oferta_ativa_tentativas")
        .select("created_at")
        .eq("corretor_id", user!.id)
        .gte("created_at", `${startDate}T00:00:00-03:00`);

      // Count tentativas per day
      const tentsByDay = new Map<string, number>();
      (tentativas || []).forEach(t => {
        const day = new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        tentsByDay.set(day, (tentsByDay.get(day) || 0) + 1);
      });

      // Count consecutive days where tentativas >= meta_ligacoes
      let streak = 0;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      
      for (const goal of goals) {
        const dayTents = tentsByDay.get(goal.data) || 0;
        if (dayTents >= goal.meta_ligacoes) {
          streak++;
        } else if (goal.data !== today) {
          // Allow today to be incomplete, but break on past missed days
          break;
        }
      }

      return streak;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Fetch user's badges/conquistas
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

  const streakInfo = getStreakInfo(streakDays);
  const unlockedBadgeIds = new Set(conquistas.map(c => c.conquista_id));

  // Map conquistas to display badges
  const displayBadges = useMemo(() => {
    return BADGES.map(b => ({
      ...b,
      unlocked: unlockedBadgeIds.has(b.id),
    }));
  }, [unlockedBadgeIds]);

  if (streakDays === 0 && conquistas.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Streak */}
      {streakDays > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Flame className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{streakInfo.emoji} {streakDays} dias de streak!</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                {streakInfo.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {streakDays >= 10 ? "Você é imparável! Mantenha o ritmo." :
               streakDays >= 5 ? "Sequência incrível! Continue assim." :
               streakDays >= 3 ? "Boa sequência! Continue batendo metas." :
               "Bata a meta hoje para manter sua streak!"}
            </p>
          </div>
        </motion.div>
      )}

      {/* Badges */}
      {displayBadges.some(b => b.unlocked) && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Award className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Conquistas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayBadges.filter(b => b.unlocked).map(b => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent border border-border"
                title={b.desc}
              >
                <span className="text-sm">{b.emoji}</span>
                <span className="text-[11px] font-medium text-foreground">{b.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
