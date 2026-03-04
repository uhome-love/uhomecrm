import { useState, useEffect } from "react";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Star, Flame, Target, Loader2, Phone, ThumbsUp, Percent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BADGES_CONFIG = [
  { key: "discador", label: "Discador do Dia", icon: Phone, color: "text-blue-500", check: (r: any[]) => r[0] },
  { key: "matador", label: "Matador de Oportunidades", icon: ThumbsUp, color: "text-emerald-500", check: (r: any[]) => r.sort((a: any, b: any) => b.aproveitados - a.aproveitados)[0] },
  { key: "taxa", label: "Alta Conversão", icon: Percent, color: "text-purple-500", check: (r: any[]) => r.filter((x: any) => x.tentativas >= 5).sort((a: any, b: any) => (b.aproveitados / b.tentativas) - (a.aproveitados / a.tentativas))[0] },
];

export default function RankingPanel() {
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const { ranking, totalTentativas, isLoading } = useOARanking(period);
  const { user } = useAuth();

  // Fetch corretor names
  const corretorIds = ranking.map(r => r.corretor_id);
  const { data: profiles } = useQuery({
    queryKey: ["oa-ranking-profiles", corretorIds.join(",")],
    queryFn: async () => {
      if (corretorIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", corretorIds);
      const map: Record<string, string> = {};
      for (const p of data || []) map[p.user_id] = p.nome;
      return map;
    },
    enabled: corretorIds.length > 0,
  });

  const getMedalIcon = (pos: number) => {
    if (pos === 0) return <Trophy className="h-5 w-5 text-amber-400" />;
    if (pos === 1) return <Medal className="h-5 w-5 text-slate-400" />;
    if (pos === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{pos + 1}</span>;
  };

  // My stats
  const myStats = ranking.find(r => r.corretor_id === user?.id);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {(["hoje", "semana", "mes"] as const).map(p => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="text-xs" onClick={() => setPeriod(p)}>
            {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
          </Button>
        ))}
      </div>

      {/* My progress */}
      {myStats && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Seu progresso</p>
                <p className="text-2xl font-bold text-primary">{myStats.pontos} pts</p>
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

            {/* Progress bar - daily goal example */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Meta: 30 tentativas</span>
                <span className="font-semibold">{Math.min(100, Math.round((myStats.tentativas / 30) * 100))}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary rounded-full h-2.5 transition-all"
                  style={{ width: `${Math.min(100, (myStats.tentativas / 30) * 100)}%` }}
                />
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
          {/* Ranking table */}
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
                    <th className="py-2 px-3 text-center">📞</th>
                    <th className="py-2 px-3 text-center">💬</th>
                    <th className="py-2 px-3 text-center">✉️</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const isMe = r.corretor_id === user?.id;
                    const taxa = r.tentativas > 0 ? Math.round((r.aproveitados / r.tentativas) * 100) : 0;
                    return (
                      <tr key={r.corretor_id} className={`border-b border-border ${isMe ? "bg-primary/5" : i % 2 ? "bg-muted/5" : ""}`}>
                        <td className="py-2.5 px-3">{getMedalIcon(i)}</td>
                        <td className="py-2.5 px-3 font-medium">
                          {profiles?.[r.corretor_id] || "Corretor"}
                          {isMe && <Badge className="ml-2 text-[9px] h-4">Você</Badge>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-primary">{r.pontos}</td>
                        <td className="py-2.5 px-3 text-center">{r.tentativas}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">{r.aproveitados}</td>
                        <td className="py-2.5 px-3 text-center">{taxa}%</td>
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

          {/* Badges */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Selos do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {BADGES_CONFIG.map(badge => {
                  const winner = badge.check([...ranking]);
                  if (!winner) return null;
                  const Icon = badge.icon;
                  return (
                    <div key={badge.key} className="text-center p-3 rounded-lg border border-border bg-muted/30">
                      <Icon className={`h-6 w-6 mx-auto mb-1 ${badge.color}`} />
                      <p className="text-xs font-semibold">{badge.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {profiles?.[winner.corretor_id] || "Corretor"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
