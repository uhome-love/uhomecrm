/**
 * RankingPositionCard — Shows WHY the user is in their current position
 * and WHAT they need to do to climb.
 */

import { motion } from "framer-motion";
import { TrendingUp, Target, Phone, ClipboardList, DollarSign, Zap, ChevronUp } from "lucide-react";

interface PillarRank {
  label: string;
  rank: number;
  total: number;
  icon: React.ElementType;
  color: string;
}

interface ClimbTip {
  text: string;
  icon: React.ElementType;
}

interface Props {
  nome: string;
  posicao: number;
  scoreGeral: number;
  pillarRanks: PillarRank[];
  climbTips: ClimbTip[];
  delta?: number;
}

export default function RankingPositionCard({ nome, posicao, scoreGeral, pillarRanks, climbTips, delta }: Props) {
  const firstName = nome.split(" ")[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3"
    >
      {/* Header: Your position */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {firstName}, você está em <span className="text-primary text-lg font-black">{posicao}º</span> lugar
            </p>
            <p className="text-xs text-muted-foreground">
              Nota geral: <span className="font-bold text-foreground">{scoreGeral}/100</span>
              {delta !== undefined && delta !== 0 && (
                <span className={`ml-2 font-bold ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {delta > 0 ? `↑ subiu ${delta}` : `↓ caiu ${Math.abs(delta)}`} posição(ões)
                </span>
              )}
              {delta === 0 && (
                <span className="ml-2 text-muted-foreground font-medium">— manteve posição</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Why you're here */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Por que você está em {posicao}º:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {pillarRanks.map(p => (
            <div
              key={p.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border"
            >
              <p.icon className={`h-3.5 w-3.5 ${p.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{p.label}</p>
                <p className="text-xs font-black text-foreground">
                  #{p.rank}<span className="text-[9px] font-normal text-muted-foreground">/{p.total}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to climb */}
      {climbTips.length > 0 && posicao > 1 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <ChevronUp className="h-3 w-3" />
            Para subir para {posicao - 1}º lugar:
          </p>
          <div className="flex flex-wrap gap-2">
            {climbTips.map((tip, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
              >
                <tip.icon className="h-3 w-3 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {posicao === 1 && (
        <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
          👑 Você lidera! Continue assim para manter a posição.
        </p>
      )}
    </motion.div>
  );
}
