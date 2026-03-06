import { useState, useMemo } from "react";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Phone, ThumbsUp, TrendingUp, Loader2, Flame } from "lucide-react";

const medals = ["🥇", "🥈", "🥉"];

export default function RankingOfertaAtiva() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const { ranking, totalTentativas, isLoading } = useOARanking(period);

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

  const getInitials = (nome: string) =>
    nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const getMedalIcon = (pos: number) => {
    if (pos === 0) return <Trophy className="h-5 w-5 text-amber-400" />;
    if (pos === 1) return <Medal className="h-5 w-5 text-slate-400" />;
    if (pos === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{pos + 1}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            <h2 className="font-display font-bold text-lg text-foreground">Ranking Oferta Ativa</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAdmin ? "Visão completa da empresa" : "Ranking da sua equipe"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["hoje", "semana", "mes"] as const).map(p => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="text-xs" onClick={() => setPeriod(p)}>
              {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Tentativas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalTentativas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Interessados</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{totals.aproveitados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Taxa Conversão</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{taxaGeral}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Total Pontos</span>
            </div>
            <p className="text-2xl font-bold text-warning">{totals.pontos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : ranking.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sem dados de oferta ativa para o período selecionado</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Ranking por Pontos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
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
                    const taxa = r.tentativas > 0 ? Math.round((r.aproveitados / r.tentativas) * 100) : 0;
                    return (
                      <tr key={r.corretor_id} className={`border-b border-border ${i % 2 ? "bg-muted/5" : ""}`}>
                        <td className="py-2.5 px-3">{getMedalIcon(i)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px]">{getInitials(r.nome)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate">{r.nome}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-primary">{r.pontos}</td>
                        <td className="py-2.5 px-3 text-center">{r.tentativas}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">{r.aproveitados}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 ${taxa >= 15 ? "text-emerald-600 border-emerald-500/30" : taxa >= 8 ? "text-blue-600 border-blue-500/30" : "text-muted-foreground"}`}
                          >
                            {taxa}%
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">{r.ligacoes}</td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">{r.whatsapps}</td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">{r.emails}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
