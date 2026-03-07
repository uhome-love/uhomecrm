import { motion } from "framer-motion";
import { Trophy, Medal, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RankingEntry } from "@/hooks/useMissoesLeads";

interface Props {
  ranking: RankingEntry[];
  loading: boolean;
  userId?: string;
}

const medals = ["🥇", "🥈", "🥉"];

export default function RankingGestaoLeads({ ranking, loading, userId }: Props) {
  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Carregando ranking...
        </CardContent>
      </Card>
    );
  }

  if (ranking.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 text-center space-y-2">
          <Trophy className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">
            Ranking será atualizado conforme o time trabalhar leads hoje.
          </p>
        </CardContent>
      </Card>
    );
  }

  const myPosition = ranking.findIndex(r => r.corretor_id === userId) + 1;

  return (
    <Card className="border-primary/10 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Ranking Gestão de Leads</h3>
              <p className="text-[10px] text-muted-foreground">Competição do dia</p>
            </div>
          </div>
          {myPosition > 0 && (
            <Badge variant="outline" className="gap-1 text-xs font-bold">
              <Medal className="h-3 w-3" /> #{myPosition}
            </Badge>
          )}
        </div>

        {/* Top 3 podium */}
        {ranking.length >= 3 && (
          <div className="flex items-end justify-center gap-3 py-2">
            {/* 2nd place */}
            <div className="text-center">
              <span className="text-2xl">{medals[1]}</span>
              <p className="text-[10px] font-bold text-foreground truncate max-w-[70px]">
                {ranking[1].corretor_nome.split(" ")[0]}
              </p>
              <p className="text-xs font-mono font-bold text-muted-foreground">{ranking[1].pontos_total}</p>
            </div>
            {/* 1st place */}
            <div className="text-center -mt-2">
              <span className="text-3xl">{medals[0]}</span>
              <p className="text-xs font-bold text-foreground truncate max-w-[80px]">
                {ranking[0].corretor_nome.split(" ")[0]}
              </p>
              <p className="text-sm font-mono font-extrabold text-primary">{ranking[0].pontos_total}</p>
            </div>
            {/* 3rd place */}
            <div className="text-center">
              <span className="text-2xl">{medals[2]}</span>
              <p className="text-[10px] font-bold text-foreground truncate max-w-[70px]">
                {ranking[2].corretor_nome.split(" ")[0]}
              </p>
              <p className="text-xs font-mono font-bold text-muted-foreground">{ranking[2].pontos_total}</p>
            </div>
          </div>
        )}

        {/* Full list */}
        <div className="space-y-1">
          {ranking.slice(0, 10).map((r, i) => {
            const isMe = r.corretor_id === userId;
            return (
              <motion.div
                key={r.corretor_id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isMe
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-accent/50"
                }`}
              >
                <span className="text-sm font-bold text-muted-foreground w-5 text-right shrink-0">
                  {i < 3 ? medals[i] : `${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                    {r.corretor_nome}
                    {isMe && <span className="text-[9px] text-primary/70 ml-1">(você)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                  <span title="Tentativas">📞 {r.tentativas}</span>
                  <span title="Visitas">📅 {r.visitas_marcadas}</span>
                </div>
                <span className={`text-xs font-mono font-extrabold shrink-0 ${isMe ? "text-primary" : "text-foreground"}`}>
                  {r.pontos_total} pts
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* My position if not in top 10 */}
        {myPosition > 10 && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <span className="text-sm font-bold text-primary w-5 text-right">#{myPosition}</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-primary flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Você
              </p>
            </div>
            <span className="text-xs font-mono font-extrabold text-primary">
              {ranking[myPosition - 1]?.pontos_total || 0} pts
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
