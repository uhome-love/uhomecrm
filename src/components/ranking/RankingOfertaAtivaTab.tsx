import { useMemo } from "react";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, ThumbsUp, TrendingUp, Flame, Loader2 } from "lucide-react";
import { getLevel } from "@/lib/gamification";
import RankingPodium, { type PodiumEntry } from "./RankingPodium";

const medals = ["👑", "🥈", "🥉"];

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function RankingOfertaAtivaTab({ period }: { period: "hoje" | "semana" | "mes" }) {
  const { ranking, totalTentativas, isLoading } = useOARanking(period);
  const { user } = useAuth();

  const totals = useMemo(() => {
    return ranking.reduce(
      (acc, c) => ({
        tentativas: acc.tentativas + c.tentativas,
        aproveitados: acc.aproveitados + c.aproveitados,
        pontos: acc.pontos + c.pontos,
      }),
      { tentativas: 0, aproveitados: 0, pontos: 0 }
    );
  }, [ranking]);

  const taxaGeral = totals.tentativas > 0 ? Math.round((totals.aproveitados / totals.tentativas) * 100) : 0;

  const podiumEntries: PodiumEntry[] = useMemo(() => {
    return ranking.slice(0, 3).map(r => ({
      id: r.corretor_id,
      nome: r.nome,
      value: `${r.pontos}pts`,
      points: r.pontos,
      isMe: r.corretor_id === user?.id,
    }));
  }, [ranking, user?.id]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (ranking.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sem dados de oferta ativa para o período</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Phone, label: "Total Tentativas", value: totalTentativas, color: "text-primary" },
          { icon: ThumbsUp, label: "Interessados", value: totals.aproveitados, color: "text-emerald-600" },
          { icon: TrendingUp, label: "Taxa Conversão", value: `${taxaGeral}%`, color: "text-purple-600" },
          { icon: Flame, label: "Total Pontos", value: totals.pontos, color: "text-warning" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Podium */}
      {podiumEntries.length >= 3 && (
        <Card><CardContent className="pb-0 pt-2">
          <RankingPodium entries={podiumEntries} />
        </CardContent></Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 px-3 text-left w-10">#</th>
                  <th className="py-2 px-3 text-left">Corretor</th>
                  <th className="py-2 px-3 text-center">Título</th>
                  <th className="py-2 px-3 text-center">Ligações</th>
                  <th className="py-2 px-3 text-center">Aprov.</th>
                  <th className="py-2 px-3 text-center">Taxa</th>
                  <th className="py-2 px-3 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const taxa = r.tentativas > 0 ? Math.round((r.aproveitados / r.tentativas) * 100) : 0;
                  const isMe = r.corretor_id === user?.id;
                  const level = getLevel(r.pontos);
                  return (
                    <tr
                      key={r.corretor_id}
                      className={`border-b border-border transition-colors ${isMe ? "bg-primary/5 border-l-2 border-l-primary" : i % 2 ? "bg-muted/5" : ""}`}
                    >
                      <td className="py-2.5 px-3">
                        {i < 3 ? <span className="text-base">{medals[i]}</span> : <span className="text-sm text-muted-foreground font-bold">{i + 1}</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">{getInitials(r.nome)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">{r.nome}</span>
                          {isMe && <span className="text-[10px] text-primary font-medium">← você</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-semibold ${level.color}`}>{level.emoji} {level.label}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">{r.tentativas}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">{r.aproveitados}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] h-5 ${taxa >= 15 ? "text-emerald-600 border-emerald-500/30" : taxa >= 8 ? "text-blue-600 border-blue-500/30" : "text-muted-foreground"}`}>
                          {taxa}%
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-primary">{r.pontos}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
