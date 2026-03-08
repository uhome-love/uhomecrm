import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ACHIEVEMENTS, getAchievementDef, type AchievementDef } from "@/lib/gamification";

export interface UnlockedAchievement {
  conquista_id: string;
  desbloqueada_em: string;
}

export function useConquistas() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementDef | null>(null);

  const loadUnlocked = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("corretor_conquistas" as any)
      .select("conquista_id, desbloqueada_em")
      .eq("user_id", user.id)
      .order("desbloqueada_em", { ascending: false });
    setUnlocked((data || []) as unknown as UnlockedAchievement[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadUnlocked(); }, [loadUnlocked]);

  const unlock = useCallback(async (conquista_id: string) => {
    if (!user) return;
    if (unlocked.some(u => u.conquista_id === conquista_id)) return;

    const { error } = await supabase
      .from("corretor_conquistas" as any)
      .insert({ user_id: user.id, conquista_id } as any);

    if (error && !error.message.includes("duplicate")) {
      console.error("Failed to unlock achievement:", error);
      return;
    }

    const def = getAchievementDef(conquista_id);
    if (def) {
      setNewlyUnlocked(def);
      // Auto-clear after 4 seconds
      setTimeout(() => setNewlyUnlocked(null), 4000);
    }

    // Notify team for special achievements
    if (def?.special && user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        tipo: "conquista",
        categoria: "conquista",
        titulo: "🏆 Conquista desbloqueada!",
        mensagem: `${def.emoji} ${def.label} — ${def.description}`,
        dados: { conquista_id, special: true },
      });
    }

    loadUnlocked();
  }, [user, unlocked, loadUnlocked]);

  const isUnlocked = useCallback((id: string) => unlocked.some(u => u.conquista_id === id), [unlocked]);

  const dismissCelebration = useCallback(() => setNewlyUnlocked(null), []);

  return {
    unlocked,
    loading,
    unlock,
    isUnlocked,
    newlyUnlocked,
    dismissCelebration,
    allAchievements: ACHIEVEMENTS,
  };
}

/**
 * Check achievements based on current stats and unlock any new ones.
 * Call this after stats refresh.
 */
export function checkAndUnlockAchievements(
  unlock: (id: string) => Promise<void>,
  stats: {
    tentativasHoje: number;
    aproveitadosHoje: number;
    visitasHoje: number;
    ligacoesHoje: number;
    tentativasSemana: number;
    tentativasMes: number;
    taxaAproveitamentoSemana: number;
    streak: number;
    diasMes: number;
    diasMetaBatidaMes: number;
    rankingPosicaoMes: number;
    rankingPosicaoSemana: number;
    vgvAcumulado: number;
    temVenda: boolean;
    temVisitaMarcada: boolean;
  }
) {
  // Volume
  if (stats.temVisitaMarcada) unlock("primeira_visita");
  if (stats.ligacoesHoje >= 10) unlock("dez_ligacoes");
  if (stats.tentativasSemana >= 100) unlock("centuriao");
  if (stats.tentativasMes >= 500) unlock("maratonista");

  // Qualidade
  if (stats.aproveitadosHoje >= 5) unlock("sniper");
  if (stats.taxaAproveitamentoSemana > 20 && stats.tentativasSemana >= 10) unlock("conversor");
  if (stats.temVenda) unlock("fechador");
  if (stats.visitasHoje >= 3) unlock("hat_trick");

  // Consistência
  if (stats.streak >= 5) unlock("sequencia_5");
  if (stats.streak >= 10) unlock("sequencia_10");
  if (stats.diasMes > 0 && stats.diasMetaBatidaMes >= stats.diasMes) unlock("mes_perfeito");

  // Especiais
  if (stats.rankingPosicaoMes === 1) unlock("top1_mes");
  if (stats.rankingPosicaoSemana === 1) unlock("melhor_semana");
  if (stats.vgvAcumulado >= 1_000_000) unlock("vgv_milionario");
}
