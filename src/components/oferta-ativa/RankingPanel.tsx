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

interface RankingPanelProps {
  darkMode?: boolean;
}

export default function RankingPanel({ darkMode = false }: RankingPanelProps) {
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
        const brtDate = new Date(d.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        byCorretor[d.corretor_id].add(brtDate);
      }

      for (const [cid, dates] of Object.entries(byCorretor)) {
        let streak = 0;
        const todayBrt = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        let checkDate = new Date(todayBrt + "T12:00:00-03:00");
        for (let i = 0; i < 30; i++) {
          const dateStr = checkDate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          if (dates.has(dateStr)) {
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
    return <span className={`text-sm font-bold w-5 text-center ${darkMode ? "text-gray-500" : "text-muted-foreground"}`}>{pos + 1}</span>;
  };

  const getInitials = (nome: string) => {
    return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  };

  const myStats = ranking.find(r => r.corretor_id === user?.id);
  const myStreak = streaks?.[user?.id || ""] || 0;

  // Dark mode styles
  const dk = darkMode ? {
    bg: "#0A0F1E",
    card: "#1C2128",
    border: "rgba(255,255,255,0.08)",
    text: "#E5E7EB",
    textMuted: "#6B7280",
    textSecondary: "#9CA3AF",
  } : null;

  return (
    <div className="space-y-4" style={dk ? { background: dk.bg, minHeight: "100%" } : undefined}>
      {/* Period filters */}
      <div className="flex items-center gap-2">
        {(["hoje", "semana", "mes"] as const).map(p => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? "default" : "outline"}
            className="text-xs"
            style={dk ? {
              background: period === p ? "#3B82F6" : "transparent",
              color: period === p ? "#fff" : "#9CA3AF",
              border: period === p ? "none" : "1px solid rgba(255,255,255,0.1)",
            } : undefined}
            onClick={() => setPeriod(p)}
          >
            {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
          </Button>
        ))}
      </div>

      {/* My stats */}
      {myStats && (
        <div
          className={dk ? "rounded-xl" : ""}
          style={dk ? { background: dk.card, border: `1px solid ${dk.border}`, padding: 16, borderRadius: 12 } : undefined}
        >
          {!dk && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <MyStatsContent myStats={myStats} myStreak={myStreak} darkMode={darkMode} />
              </CardContent>
            </Card>
          )}
          {dk && <MyStatsContent myStats={myStats} myStreak={myStreak} darkMode={darkMode} />}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" style={dk ? { color: "#3B82F6" } : undefined} />
        </div>
      ) : ranking.length === 0 ? (
        <div
          className={dk ? "py-12 text-center rounded-xl" : ""}
          style={dk ? { background: dk.card, border: `1px solid ${dk.border}` } : undefined}
        >
          {!dk && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhuma tentativa registrada</p>
                <p className="text-sm mt-1">Comece a discar para aparecer no ranking!</p>
              </CardContent>
            </Card>
          )}
          {dk && (
            <>
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" style={{ color: "#6B7280" }} />
              <p className="font-medium" style={{ color: "#E5E7EB" }}>Nenhuma tentativa registrada</p>
              <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Comece a discar para aparecer no ranking!</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Ranking table */}
          <div
            className="rounded-xl overflow-hidden"
            style={dk ? { background: dk.card, border: `1px solid ${dk.border}` } : undefined}
          >
            {dk ? (
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold" style={{ color: "#E5E7EB" }}>Ranking por Pontos</span>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" /> Ranking por Pontos
                  </CardTitle>
                </CardHeader>
              </Card>
            )}
            <div style={!dk ? undefined : {}}>
              {!dk && <Card><CardContent className="p-0"><RankingTable ranking={ranking} user={user} streaks={streaks} getMedalIcon={getMedalIcon} getInitials={getInitials} darkMode={false} /></CardContent></Card>}
              {dk && <RankingTable ranking={ranking} user={user} streaks={streaks} getMedalIcon={getMedalIcon} getInitials={getInitials} darkMode={true} />}
            </div>
          </div>

          {/* Badges */}
          <div
            className="rounded-xl"
            style={dk ? { background: dk.card, border: `1px solid ${dk.border}`, padding: 16 } : undefined}
          >
            {dk ? (
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold" style={{ color: "#E5E7EB" }}>Selos do Período</span>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" /> Selos do Período
                  </CardTitle>
                </CardHeader>
              </Card>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={!dk ? { padding: "0 16px 16px" } : undefined}>
              {BADGES_CONFIG.map(badge => {
                const winner = badge.check([...ranking]);
                if (!winner) return null;
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.key}
                    className="text-center p-3 rounded-lg"
                    style={dk ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" } : undefined}
                    {...(!dk ? { className: "text-center p-3 rounded-lg border border-border bg-muted/30" } : {})}
                  >
                    <Icon className={`h-6 w-6 mx-auto mb-1 ${badge.color}`} />
                    <p className="text-xs font-semibold" style={dk ? { color: "#E5E7EB" } : undefined}>{badge.label}</p>
                    <p className="text-[10px] mt-0.5" style={dk ? { color: "#6B7280" } : { color: "var(--muted-foreground)" }}>{winner.nome || "Corretor"}</p>
                  </div>
                );
              })}
              {streakWinner && (
                <div
                  className="text-center p-3 rounded-lg"
                  style={dk ? { background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" } : undefined}
                  {...(!dk ? { className: "text-center p-3 rounded-lg border border-orange-500/20 bg-orange-500/5" } : {})}
                >
                  <Flame className="h-6 w-6 mx-auto mb-1 text-orange-500" />
                  <p className="text-xs font-semibold" style={dk ? { color: "#E5E7EB" } : undefined}>Consistência</p>
                  <p className="text-[10px] mt-0.5" style={dk ? { color: "#6B7280" } : { color: "var(--muted-foreground)" }}>
                    {ranking.find(r => r.corretor_id === streakWinner.corretor_id)?.nome || "Corretor"} ({streakWinner.streak}d)
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="mt-4">
        <ScoringLegend />
      </div>
    </div>
  );
}

// ─── Sub-components ───

function MyStatsContent({ myStats, myStreak, darkMode }: { myStats: any; myStreak: number; darkMode: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs" style={darkMode ? { color: "#6B7280" } : undefined}>{!darkMode && <span className="text-muted-foreground">Seu progresso</span>}{darkMode && "Seu progresso"}</p>
        <p className="text-2xl font-bold" style={darkMode ? { color: "#60A5FA" } : undefined} {...(!darkMode ? { className: "text-2xl font-bold text-primary" } : {})}>{myStats.pontos} pts</p>
        {myStreak >= 2 && (
          <div className="flex items-center gap-1 mt-1">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-500">{myStreak} dias seguidos!</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-lg font-bold" style={darkMode ? { color: "#E5E7EB" } : undefined}>{myStats.tentativas}</p>
          <p className="text-[10px]" style={darkMode ? { color: "#6B7280" } : undefined} {...(!darkMode ? { className: "text-[10px] text-muted-foreground" } : {})}>Tentativas</p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: "#22C55E" }}>{myStats.aproveitados}</p>
          <p className="text-[10px]" style={darkMode ? { color: "#6B7280" } : undefined} {...(!darkMode ? { className: "text-[10px] text-muted-foreground" } : {})}>Aproveitados</p>
        </div>
        <div>
          <p className="text-lg font-bold" style={darkMode ? { color: "#E5E7EB" } : undefined}>
            {myStats.tentativas > 0 ? Math.round((myStats.aproveitados / myStats.tentativas) * 100) : 0}%
          </p>
          <p className="text-[10px]" style={darkMode ? { color: "#6B7280" } : undefined} {...(!darkMode ? { className: "text-[10px] text-muted-foreground" } : {})}>Taxa</p>
        </div>
      </div>
    </div>
  );
}

function RankingTable({ ranking, user, streaks, getMedalIcon, getInitials, darkMode }: {
  ranking: any[];
  user: any;
  streaks: Record<string, number> | undefined;
  getMedalIcon: (pos: number) => React.ReactNode;
  getInitials: (nome: string) => string;
  darkMode: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={darkMode ? { borderBottom: "1px solid rgba(255,255,255,0.05)" } : undefined} className={!darkMode ? "border-b border-border" : ""}>
          {["#", "Corretor", "Pts", "Tent.", "Aprov.", "Taxa", "🔥", "📞", "💬", "✉️"].map((h, i) => (
            <th
              key={h}
              className={`py-2 px-3 text-xs uppercase ${i <= 1 ? "text-left" : "text-center"}`}
              style={darkMode ? { color: "#4B5563", fontWeight: 600, letterSpacing: "0.05em" } : { color: "var(--muted-foreground)" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ranking.map((r: any, i: number) => {
          const isMe = r.corretor_id === user?.id;
          const taxa = r.tentativas > 0 ? Math.round((r.aproveitados / r.tentativas) * 100) : 0;
          const streak = streaks?.[r.corretor_id] || 0;

          const rowStyle = darkMode
            ? {
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: isMe ? "rgba(59,130,246,0.1)" : "transparent",
                ...(isMe ? { border: "1px solid rgba(59,130,246,0.2)" } : {}),
              }
            : undefined;

          return (
            <tr
              key={r.corretor_id}
              className={!darkMode ? `border-b border-border ${isMe ? "bg-primary/5" : i % 2 ? "bg-muted/5" : ""}` : "transition-colors"}
              style={rowStyle}
              onMouseEnter={darkMode ? (e) => { if (!isMe) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.03)"; } : undefined}
              onMouseLeave={darkMode ? (e) => { if (!isMe) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; } : undefined}
            >
              <td className="py-2.5 px-3">{getMedalIcon(i)}</td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.nome} />}
                    <AvatarFallback className="text-[10px]" style={darkMode ? { background: "rgba(255,255,255,0.08)", color: "#9CA3AF" } : undefined}>{getInitials(r.nome)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium" style={darkMode ? { color: "#D1D5DB" } : undefined}>{r.nome}</span>
                  {isMe && (
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={darkMode ? { background: "#3B82F6", color: "#fff" } : undefined}
                    >
                      {!darkMode && <Badge className="text-[9px] h-4">Você</Badge>}
                      {darkMode && "Você"}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-3 text-center font-bold" style={darkMode ? { color: "#60A5FA" } : undefined} {...(!darkMode ? { className: "py-2.5 px-3 text-center font-bold text-primary" } : {})}>{r.pontos}</td>
              <td className="py-2.5 px-3 text-center" style={darkMode ? { color: "#9CA3AF" } : undefined}>{r.tentativas}</td>
              <td className="py-2.5 px-3 text-center font-semibold" style={{ color: "#22C55E" }}>{r.aproveitados}</td>
              <td className="py-2.5 px-3 text-center" style={darkMode ? { color: "#9CA3AF" } : undefined}>{taxa}%</td>
              <td className="py-2.5 px-3 text-center">
                {streak >= 2 ? <span className="text-orange-500 font-bold">{streak}d</span> : <span style={darkMode ? { color: "#374151" } : undefined} className={!darkMode ? "text-muted-foreground" : ""}>—</span>}
              </td>
              <td className="py-2.5 px-3 text-center" style={darkMode ? { color: "#4B5563" } : undefined} className={!darkMode ? "py-2.5 px-3 text-center text-muted-foreground" : "py-2.5 px-3 text-center"}>{r.ligacoes}</td>
              <td className="py-2.5 px-3 text-center" style={darkMode ? { color: "#4B5563" } : undefined} className={!darkMode ? "py-2.5 px-3 text-center text-muted-foreground" : "py-2.5 px-3 text-center"}>{r.whatsapps}</td>
              <td className="py-2.5 px-3 text-center" style={darkMode ? { color: "#4B5563" } : undefined} className={!darkMode ? "py-2.5 px-3 text-center text-muted-foreground" : "py-2.5 px-3 text-center"}>{r.emails}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
