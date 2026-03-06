import { useState, useMemo } from "react";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Star, Flame, Loader2, Phone, ThumbsUp, Percent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ScoringLegend from "./ScoringLegend";

const BADGES_CONFIG = [
  { key: "discador", label: "Discador do Dia", icon: Phone, color: "text-blue-500", check: (r: any[]) => r[0] },
  { key: "matador", label: "Matador de Oportunidades", icon: ThumbsUp, color: "text-emerald-500", check: (r: any[]) => [...r].sort((a, b) => b.aproveitados - a.aproveitados)[0] },
  { key: "taxa", label: "Alta Conversão", icon: Percent, color: "text-purple-500", check: (r: any[]) => [...r].filter(x => x.tentativas >= 5).sort((a, b) => (b.aproveitados / b.tentativas) - (a.aproveitados / a.tentativas))[0] },
];

export default function RankingPanel() {
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const { ranking, totalTentativas, isLoading } = useOARanking(period);
  const { user } = useAuth();

  // Streak calculation
  const corretorIds = ranking.map(r => r.corretor_id);
  const { data: streaks } = useQuery({
    queryKey: ["oa-streaks", corretorIds.join(",")],
    queryFn: async () => {
      if (corretorIds.length === 0) return {};
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .in("corretor_id", corretorIds)
        .order("created_at", { ascending: false });

      const streakMap: Record<string, number> = {};
      if (!data) return streakMap;

      const byCorretor: Record<string, Set<string>> = {};
      for (const d of data) {
        if (!byCorretor[d.corretor_id]) byCorretor[d.corretor_id] = new Set();
        byCorretor[d.corretor_id].add(new Date(d.created_at).toISOString().split("T")[0]);
      }

      for (const [cid, dates] of Object.entries(byCorretor)) {
        const sorted = [...dates].sort().reverse();
        let streak = 0;
        const today = new Date().toISOString().split("T")[0];
        let checkDate = new Date(today);
        for (let i = 0; i < 30; i++) {
          const dateStr = checkDate.toISOString().split("T")[0];
          if (sorted.includes(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else break;
        }
        streakMap[cid] = streak;
      }
      return streakMap;
    },
    enabled: corretorIds.length > 0,
  });

  const streakWinner = useMemo(() => {
    if (!streaks) return null;
    const entries = Object.entries(streaks).filter(([, v]) => v >= 2);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { corretor_id: entries[0][0], streak: entries[0][1] };
  }, [streaks]);

  const getMedalIcon = (pos: number) => {
    if (pos === 0) return <Trophy className="h-5 w-5 text-amber-400" />;
    if (pos === 1) return <Medal className="h-5 w-5 text-slate-400" />;
    if (pos === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{pos + 1}</span>;
  };

  const getInitials = (nome: string) => {
    return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  };

  const myStats = ranking.find(r => r.corretor_id === user?.id);
  const myStreak = streaks?.[user?.id || ""] || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["hoje", "semana", "mes"] as const).map(p => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="text-xs" onClick={() => setPeriod(p)}>
            {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
          </Button>
        ))}
      </div>

      {myStats && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Seu progresso</p>
                <p className="text-2xl font-bold text-primary">{myStats.pontos} pts</p>
                {myStreak >= 2 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-xs font-semibold text-orange-600">{myStreak} dias seguidos!</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">{myStats.tentativas}</p>
                  <p className="text-[10px] text-muted-foreground">Tentativas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{myStats.aproveitados}</p>
                  <p className="text-[10px] text-muted-foreground">Aproveitados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {myStats.tentativas > 0 ? Math.round((myStats.aproveitados / myStats.tentativas) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Taxa</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : ranking.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma tentativa registrada</p>
            <p className="text-sm mt-1">Comece a discar para aparecer no ranking!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Ranking por Pontos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 px-3 text-left w-10">#</th>
                    <th className="py-2 px-3 text-left">Corretor</th>
                    <th className="py-2 px-3 text-center">Pts</th>
                    <th className="py-2 px-3 text-center">Tent.</th>
                    <th className="py-2 px-3 text-center">Aprov.</th>
                    <th className="py-2 px-3 text-center">Taxa</th>
                    <th className="py-2 px-3 text-center">🔥</th>
                    <th className="py-2 px-3 text-center">📞</th>
                    <th className="py-2 px-3 text-center">💬</th>
                    <th className="py-2 px-3 text-center">✉️</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const isMe = r.corretor_id === user?.id;
                    const taxa = r.tentativas > 0 ? Math.round((r.aproveitados / r.tentativas) * 100) : 0;
                    const streak = streaks?.[r.corretor_id] || 0;
                    return (
                      <tr key={r.corretor_id} className={`border-b border-border ${isMe ? "bg-primary/5" : i % 2 ? "bg-muted/5" : ""}`}>
                        <td className="py-2.5 px-3">{getMedalIcon(i)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.nome} />}
                              <AvatarFallback className="text-[10px]">{getInitials(r.nome)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{r.nome}</span>
                            {isMe && <Badge className="text-[9px] h-4">Você</Badge>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-primary">{r.pontos}</td>
                        <td className="py-2.5 px-3 text-center">{r.tentativas}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">{r.aproveitados}</td>
                        <td className="py-2.5 px-3 text-center">{taxa}%</td>
                        <td className="py-2.5 px-3 text-center">
                          {streak >= 2 ? <span className="text-orange-500 font-bold">{streak}d</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">{r.ligacoes}</td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">{r.whatsapps}</td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">{r.emails}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Selos do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BADGES_CONFIG.map(badge => {
                  const winner = badge.check([...ranking]);
                  if (!winner) return null;
                  const Icon = badge.icon;
                  return (
                    <div key={badge.key} className="text-center p-3 rounded-lg border border-border bg-muted/30">
                      <Icon className={`h-6 w-6 mx-auto mb-1 ${badge.color}`} />
                      <p className="text-xs font-semibold">{badge.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{winner.nome || "Corretor"}</p>
                    </div>
                  );
                })}
                {streakWinner && (
                  <div className="text-center p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
                    <Flame className="h-6 w-6 mx-auto mb-1 text-orange-500" />
                    <p className="text-xs font-semibold">Consistência</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {ranking.find(r => r.corretor_id === streakWinner.corretor_id)?.nome || "Corretor"} ({streakWinner.streak}d)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-4">
        <ScoringLegend />
      </div>
    </div>
  );
}
