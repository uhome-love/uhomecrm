/**
 * useCorretorProgress — Single Source of Truth
 * 
 * This hook consolidates ALL daily progress state for the corretor:
 * - Goals (meta) from corretor_daily_goals table
 * - Stats (progress) from oferta_ativa_tentativas + checkpoint_lines
 * - Derived values: progress %, mission status, level, badge
 * 
 * Both CorretorHome and DialingModeWithScript MUST use this hook
 * to guarantee identical data across screens.
 */

import { useCorretorDailyStats, useCorretorDailyGoals } from "@/hooks/useCorretorDailyStats";

export interface CorretorProgress {
  // === Goals (targets) ===
  metaLigacoes: number;
  metaAproveitados: number;
  metaVisitas: number;

  // === Realized (current) ===
  tentativas: number;
  aproveitados: number;
  visitasMarcadas: number;
  pontos: number;
  ligacoes: number;
  whatsapps: number;
  emails: number;
  taxaAproveitamento: number;

  // === Progress % (0-100) ===
  progLigacoes: number;
  progAproveitados: number;
  progVisitas: number;

  // === Mission / Level ===
  missaoCumprida: boolean;
  missaoAproveitados: boolean;
  missaoVisitas: boolean;
  todasMissoesCumpridas: boolean;
  level: string;
  levelColor: string;
  nextLevelTarget: number;
  levelProgress: number;
}

export function useCorretorProgress() {
  const { stats, isLoading: statsLoading, applyOptimisticUpdate } = useCorretorDailyStats();
  const { goals, isLoading: goalsLoading, saveGoals, refetch: refetchGoals } = useCorretorDailyGoals();

  // === Targets — single computation ===
  const metaLigacoes = goals?.meta_ligacoes || 30;
  const metaAproveitados = goals?.meta_aproveitados || 5;
  const metaVisitas = goals?.meta_visitas_marcadas || 3;

  // === Progress % ===
  const progLigacoes = Math.min(100, Math.round((stats.tentativas / metaLigacoes) * 100));
  const progAproveitados = Math.min(100, Math.round((stats.aproveitados / metaAproveitados) * 100));
  const progVisitas = Math.min(100, Math.round((stats.visitas_marcadas / metaVisitas) * 100));

  // === Mission status ===
  const missaoCumprida = stats.tentativas >= metaLigacoes;
  const missaoAproveitados = stats.aproveitados >= metaAproveitados;
  const missaoVisitas = stats.visitas_marcadas >= metaVisitas;
  const todasMissoesCumpridas = missaoCumprida && missaoAproveitados && missaoVisitas;

  // === Level / Badge ===
  const totalPontos = stats.pontos;
  const level = totalPontos >= 50 ? "👑 Lenda" : totalPontos >= 30 ? "⭐ Mestre" : totalPontos >= 15 ? "🔥 Veterano" : totalPontos >= 5 ? "💪 Ativo" : "🌱 Iniciante";
  const levelColor = totalPontos >= 50 ? "text-amber-500" : totalPontos >= 30 ? "text-purple-500" : totalPontos >= 15 ? "text-orange-500" : totalPontos >= 5 ? "text-emerald-500" : "text-muted-foreground";
  const nextLevelTarget = totalPontos >= 50 ? 50 : totalPontos >= 30 ? 50 : totalPontos >= 15 ? 30 : totalPontos >= 5 ? 15 : 5;
  const levelProgress = Math.min(100, Math.round((totalPontos / nextLevelTarget) * 100));

  const progress: CorretorProgress = {
    metaLigacoes,
    metaAproveitados,
    metaVisitas,
    tentativas: stats.tentativas,
    aproveitados: stats.aproveitados,
    visitasMarcadas: stats.visitas_marcadas,
    pontos: stats.pontos,
    ligacoes: stats.ligacoes,
    whatsapps: stats.whatsapps,
    emails: stats.emails,
    taxaAproveitamento: stats.taxa_aproveitamento,
    progLigacoes,
    progAproveitados,
    progVisitas,
    missaoCumprida,
    missaoAproveitados,
    missaoVisitas,
    todasMissoesCumpridas,
    level,
    levelColor,
    nextLevelTarget,
    levelProgress,
  };

  return {
    progress,
    goals,
    isLoading: statsLoading || goalsLoading,
    saveGoals,
    refetchGoals,
    applyOptimisticUpdate,
  };
}
