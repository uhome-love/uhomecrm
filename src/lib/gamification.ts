/**
 * Gamification Engine — Levels, Achievements & Definitions
 */

// ═══════════════ LEVELS ═══════════════

export interface GamificationLevel {
  id: string;
  emoji: string;
  label: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  bgColor: string;
}

export const LEVELS: GamificationLevel[] = [
  { id: "iniciante", emoji: "🌱", label: "Iniciante", minPoints: 0, maxPoints: 99, color: "text-muted-foreground", bgColor: "bg-muted/50" },
  { id: "ativo", emoji: "⚡", label: "Ativo", minPoints: 100, maxPoints: 299, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { id: "engajado", emoji: "🔥", label: "Engajado", minPoints: 300, maxPoints: 599, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { id: "destaque", emoji: "⭐", label: "Destaque", minPoints: 600, maxPoints: 999, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { id: "elite", emoji: "💎", label: "Elite", minPoints: 1000, maxPoints: 1999, color: "text-primary", bgColor: "bg-primary/10" },
  { id: "lendario", emoji: "🏆", label: "Lendário", minPoints: 2000, maxPoints: Infinity, color: "text-purple-500", bgColor: "bg-purple-500/10" },
];

export function getLevel(points: number): GamificationLevel {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(points: number): GamificationLevel | null {
  const current = getLevel(points);
  const idx = LEVELS.indexOf(current);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function getLevelProgress(points: number): number {
  const current = getLevel(points);
  const next = getNextLevel(points);
  if (!next) return 100;
  const range = next.minPoints - current.minPoints;
  const progress = points - current.minPoints;
  return Math.min(100, Math.round((progress / range) * 100));
}

// ═══════════════ ACHIEVEMENTS ═══════════════

export type AchievementCategory = "volume" | "qualidade" | "consistencia" | "especial";

export interface AchievementDef {
  id: string;
  emoji: string;
  label: string;
  description: string;
  category: AchievementCategory;
  /** If true, triggers team-wide notification */
  special?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Volume
  { id: "primeira_visita", emoji: "🎯", label: "Primeira Visita", description: "Primeira visita marcada no sistema", category: "volume" },
  { id: "dez_ligacoes", emoji: "🎯", label: "10 Ligações", description: "10 ligações em um dia", category: "volume" },
  { id: "centuriao", emoji: "🎯", label: "Centurião", description: "100 ligações na semana", category: "volume" },
  { id: "maratonista", emoji: "🎯", label: "Maratonista", description: "500 ligações no mês", category: "volume" },

  // Qualidade
  { id: "sniper", emoji: "⭐", label: "Sniper", description: "5 aproveitamentos em um dia", category: "qualidade" },
  { id: "conversor", emoji: "⭐", label: "Conversor", description: "Taxa de aproveitamento > 20% na semana", category: "qualidade" },
  { id: "fechador", emoji: "⭐", label: "Fechador", description: "Primeira venda no sistema", category: "qualidade", special: true },
  { id: "hat_trick", emoji: "⭐", label: "Hat-trick", description: "3 visitas em um dia", category: "qualidade" },

  // Consistência
  { id: "sequencia_5", emoji: "🔥", label: "Sequência de 5", description: "Meta batida 5 dias seguidos", category: "consistencia" },
  { id: "sequencia_10", emoji: "🔥", label: "Sequência de 10", description: "Meta batida 10 dias seguidos", category: "consistencia" },
  { id: "mes_perfeito", emoji: "🔥", label: "Mês Perfeito", description: "Meta batida todos os dias do mês", category: "consistencia" },

  // Especiais
  { id: "top1_mes", emoji: "💎", label: "Top 1 do Mês", description: "Primeiro no ranking comercial do mês", category: "especial", special: true },
  { id: "melhor_semana", emoji: "💎", label: "Melhor da Semana", description: "Primeiro no ranking OA da semana", category: "especial", special: true },
  { id: "vgv_milionario", emoji: "💎", label: "VGV Milionário", description: "R$1M em VGV assinado acumulado", category: "especial", special: true },
];

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

export const CATEGORY_LABELS: Record<AchievementCategory, { label: string; emoji: string }> = {
  volume: { label: "Volume", emoji: "📊" },
  qualidade: { label: "Qualidade", emoji: "⭐" },
  consistencia: { label: "Consistência", emoji: "🔥" },
  especial: { label: "Especial", emoji: "💎" },
};
