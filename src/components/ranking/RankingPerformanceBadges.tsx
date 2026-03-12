/**
 * RankingPerformanceBadges — Dynamic badges awarded based on current period data
 * Shows: Maior venda, melhor conversão, mais visitas, rei da prospecção, etc.
 */

import { motion } from "framer-motion";
import { Award, Crown, Phone, Eye, TrendingUp, DollarSign, Zap, Target } from "lucide-react";

export interface PerformanceBadge {
  id: string;
  emoji: string;
  label: string;
  winner: string;
  value: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

interface Props {
  badges: PerformanceBadge[];
  currentUserId?: string;
}

export default function RankingPerformanceBadges({ badges, currentUserId }: Props) {
  if (badges.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Award className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-bold text-foreground">Destaques do Período</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {badges.map((badge, i) => {
          const firstName = badge.winner.split(" ")[0];
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl p-3 border ${badge.bgColor} border-border relative overflow-hidden`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <badge.icon className={`h-3.5 w-3.5 ${badge.color}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
                  {badge.label}
                </span>
              </div>
              <p className="text-xs font-black text-foreground truncate">{firstName}</p>
              <p className={`text-sm font-black ${badge.color}`}>{badge.value}</p>
              <span className="absolute top-1 right-1 text-lg opacity-20">{badge.emoji}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Helper to compute performance badges from ranking data */
export function computePerformanceBadges(
  combined: Array<{
    corretor_id: string;
    nome: string;
    oa_pts: number;
    gestao_pts: number;
    vgv_valor: number;
    eficiencia_score: number;
    eficiencia_norm: number;
    oa_norm: number;
  }>
): PerformanceBadge[] {
  if (combined.length === 0) return [];

  const badges: PerformanceBadge[] = [];

  // Rei da Prospecção - most OA points
  const topOA = [...combined].sort((a, b) => b.oa_pts - a.oa_pts)[0];
  if (topOA.oa_pts > 0) {
    badges.push({
      id: "rei_prospeccao",
      emoji: "📞",
      label: "Rei da Prospecção",
      winner: topOA.nome,
      value: `${topOA.oa_pts} pts`,
      color: "text-blue-600",
      bgColor: "bg-blue-50/50 dark:bg-blue-900/10",
      icon: Phone,
    });
  }

  // Melhor Gestão
  const topGestao = [...combined].sort((a, b) => b.gestao_pts - a.gestao_pts)[0];
  if (topGestao.gestao_pts > 0) {
    badges.push({
      id: "melhor_gestao",
      emoji: "📋",
      label: "Mestre do Funil",
      winner: topGestao.nome,
      value: `${topGestao.gestao_pts} pts`,
      color: "text-purple-600",
      bgColor: "bg-purple-50/50 dark:bg-purple-900/10",
      icon: Target,
    });
  }

  // Maior Venda
  const topVGV = [...combined].sort((a, b) => b.vgv_valor - a.vgv_valor)[0];
  if (topVGV.vgv_valor > 0) {
    const fmtValue = topVGV.vgv_valor >= 1_000_000
      ? `R$ ${(topVGV.vgv_valor / 1_000_000).toFixed(1)}M`
      : topVGV.vgv_valor >= 1_000
      ? `R$ ${(topVGV.vgv_valor / 1_000).toFixed(0)}k`
      : `R$ ${topVGV.vgv_valor}`;
    badges.push({
      id: "maior_venda",
      emoji: "💰",
      label: "Maior Venda",
      winner: topVGV.nome,
      value: fmtValue,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50/50 dark:bg-emerald-900/10",
      icon: DollarSign,
    });
  }

  // Melhor Conversão (eficiência)
  const topEf = [...combined].sort((a, b) => b.eficiencia_norm - a.eficiencia_norm)[0];
  if (topEf.eficiencia_norm > 0) {
    badges.push({
      id: "melhor_conversao",
      emoji: "⚡",
      label: "Melhor Conversão",
      winner: topEf.nome,
      value: `${topEf.eficiencia_norm}/100`,
      color: "text-amber-600",
      bgColor: "bg-amber-50/50 dark:bg-amber-900/10",
      icon: Zap,
    });
  }

  return badges;
}
