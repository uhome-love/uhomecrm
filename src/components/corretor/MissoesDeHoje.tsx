import { motion } from "framer-motion";
import { Target, Trophy, Flame, CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Missao } from "@/hooks/useMissoesLeads";

interface Props {
  missoes: Missao[];
  missaoGeral: number;
  pontos: number;
  todasCompletas: boolean;
}

export default function MissoesDeHoje({ missoes, missaoGeral, pontos, todasCompletas }: Props) {
  return (
    <Card className="border-primary/15 overflow-hidden relative">
      {todasCompletas && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-amber-500/5 pointer-events-none" />
      )}
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                Missões de Hoje
                {todasCompletas && <Sparkles className="h-4 w-4 text-amber-500" />}
              </h3>
              <p className="text-[10px] text-muted-foreground">Complete para subir no ranking</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-display font-extrabold text-foreground">{pontos}</p>
            <p className="text-[9px] text-muted-foreground">pontos hoje</p>
          </div>
        </div>

        {/* Global progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Progresso geral</span>
            <span className={`font-bold ${missaoGeral >= 100 ? "text-emerald-500" : missaoGeral >= 60 ? "text-amber-500" : "text-muted-foreground"}`}>
              {missaoGeral}%
            </span>
          </div>
          <div className="relative">
            <Progress value={missaoGeral} className="h-3 rounded-full" />
            {missaoGeral >= 100 && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
              </div>
            )}
          </div>
        </div>

        {/* Individual missions */}
        <div className="space-y-2.5">
          {missoes.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                m.completa
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-card border-border/60"
              }`}
            >
              <span className="text-lg shrink-0">{m.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground truncate">{m.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-foreground">
                      {m.atual}/{m.meta}
                    </span>
                    {m.completa && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                </div>
                <Progress value={m.progresso} className="h-1.5" />
              </div>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 shrink-0 font-mono">
                +{m.pontosPorUnidade}
              </Badge>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
