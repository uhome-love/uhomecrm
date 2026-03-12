import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Phone, ThumbsUp, TrendingUp, Loader2, Flame, Filter } from "lucide-react";
import { getLevel } from "@/lib/gamification";

const TEAM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: "rgba(107,114,128,0.15)", text: "#9CA3AF", border: "rgba(107,114,128,0.3)" },
};

const PALETTE = [
  { bg: "rgba(34,197,94,0.15)", text: "#4ADE80", border: "rgba(34,197,94,0.3)" },
  { bg: "rgba(59,130,246,0.15)", text: "#60A5FA", border: "rgba(59,130,246,0.3)" },
  { bg: "rgba(168,85,247,0.15)", text: "#C084FC", border: "rgba(168,85,247,0.3)" },
  { bg: "rgba(251,191,36,0.15)", text: "#FBBF24", border: "rgba(251,191,36,0.3)" },
  { bg: "rgba(244,63,94,0.15)", text: "#FB7185", border: "rgba(244,63,94,0.3)" },
  { bg: "rgba(20,184,166,0.15)", text: "#2DD4BF", border: "rgba(20,184,166,0.3)" },
];

export default function RankingOfertaAtiva() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const [teamFilter, setTeamFilter] = useState<string>("todos");
  const { ranking, totalTentativas, isLoading } = useOARanking(period);

  const corretorIds = useMemo(() => ranking.map(r => r.corretor_id), [ranking]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["oa-ranking-profiles", corretorIds],
    queryFn: async () => {
      if (corretorIds.length === 0) return {};
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, avatar_url, avatar_gamificado_url")
        .in("user_id", corretorIds);
      const map: Record<string, { avatar_url: string | null }> = {};
      for (const p of profiles || []) {
        map[p.user_id] = {
          avatar_url: p.avatar_gamificado_url || p.avatar_url || null,
        };
      }
      return map;
    },
    enabled: corretorIds.length > 0,
  });

  const { data: teamMembersMap = {} } = useQuery({
    queryKey: ["oa-ranking-teams", corretorIds],
    queryFn: async () => {
      if (corretorIds.length === 0) return {};
      const { data } = await supabase
        .from("team_members")
        .select("user_id, gerente_id, gerente_nome")
        .in("user_id", corretorIds)
        .eq("status", "ativo");
      const map: Record<string, string> = {};
      for (const t of data || []) {
        if (t.user_id && t.gerente_nome) map[t.user_id] = `Equipe ${t.gerente_nome.split(" ")[0]}`;
      }
      return map;
    },
    enabled: corretorIds.length > 0,
  });

  const uniqueTeams = useMemo(() => {
    const teams = new Set<string>();
    Object.values(teamMembersMap).forEach(t => teams.add(t));
    return [...teams].sort();
  }, [teamMembersMap]);

  const teamColorMap = useMemo(() => {
    const map: Record<string, typeof PALETTE[0]> = {};
    uniqueTeams.forEach((team, i) => {
      map[team] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [uniqueTeams]);

  const filteredRanking = useMemo(() => {
    if (teamFilter === "todos") return ranking;
    return ranking.filter(r => teamMembersMap[r.corretor_id] === teamFilter);
  }, [ranking, teamFilter, teamMembersMap]);

  const getInitials = (nome: string) =>
    nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const myEntry = filteredRanking.find(r => r.corretor_id === user?.id);
  const myIndex = filteredRanking.findIndex(r => r.corretor_id === user?.id);
  const myTaxa = myEntry && myEntry.tentativas > 0 ? Math.round((myEntry.aproveitados / myEntry.tentativas) * 100) : 0;

  const getTaxaColor = (taxa: number) => {
    if (taxa >= 15) return "text-emerald-600";
    if (taxa >= 8) return "text-amber-600";
    return "text-red-500";
  };

  const getTaxaBorder = (taxa: number) => {
    if (taxa >= 15) return "border-emerald-300";
    if (taxa >= 8) return "border-amber-300";
    return "border-red-300";
  };

  return (
    <div className="space-y-4 bg-background min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="font-bold text-lg text-foreground">Ranking Oferta Ativa</h2>
          </div>
          <p className="text-xs mt-0.5 text-muted-foreground">
            {isAdmin ? "Visão completa da empresa" : "Ranking da sua equipe"}
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-2">
          {(["hoje", "semana", "mes"] as const).map(p => (
            <button
              key={p}
              className={`text-xs px-4 py-1.5 font-medium rounded-full transition-all border ${
                period === p
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-transparent hover:bg-muted"
              }`}
              onClick={() => setPeriod(p)}
            >
              {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* Team Filter */}
      {uniqueTeams.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            className={`text-[11px] px-3 py-1 font-medium rounded-full transition-all border ${
              teamFilter === "todos"
                ? "bg-foreground/10 text-foreground border-foreground/20"
                : "text-muted-foreground border-transparent"
            }`}
            onClick={() => setTeamFilter("todos")}
          >
            Todos
          </button>
          {uniqueTeams.map(team => {
            const tc = teamColorMap[team] || TEAM_COLORS.default;
            const isActive = teamFilter === team;
            return (
              <button
                key={team}
                className="text-[11px] px-3 py-1 font-medium transition-all rounded-full border"
                style={{
                  background: isActive ? tc.bg : "transparent",
                  color: isActive ? tc.text : undefined,
                  borderColor: isActive ? tc.border : "transparent",
                }}
                onClick={() => setTeamFilter(team)}
              >
                {team}
              </button>
            );
          })}
        </div>
      )}

      {/* Your Progress Card */}
      {myEntry && (
        <div className="rounded-2xl p-5 bg-primary/5 border border-primary/20">
          <p className="text-xs uppercase font-medium mb-2 text-muted-foreground tracking-widest">
            Seu progresso
          </p>
          <p className="font-black text-5xl mb-4 text-primary">
            {myEntry.pontos} pts
          </p>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs mb-0.5 text-muted-foreground">Tentativas</p>
              <p className="font-black text-2xl text-foreground">{myEntry.tentativas}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5 text-muted-foreground">Aproveitados</p>
              <p className="font-black text-2xl text-emerald-600">{myEntry.aproveitados}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5 text-muted-foreground">Taxa</p>
              <p className={`font-black text-2xl ${getTaxaColor(myTaxa)}`}>{myTaxa}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredRanking.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-muted/50 border border-border">
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30 text-amber-500" />
          <p className="text-sm text-muted-foreground">Sem dados de oferta ativa para o período selecionado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">
              Ranking por Pontos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="py-2.5 px-3 text-left w-10 text-[11px] uppercase tracking-widest font-medium text-muted-foreground">#</th>
                  <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-widest font-medium text-muted-foreground">Corretor</th>
                  <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-widest font-medium text-muted-foreground">Título</th>
                  <th className="py-2.5 px-3 text-center text-[11px] uppercase tracking-widest font-medium text-muted-foreground">Ligações</th>
                  <th className="py-2.5 px-3 text-center text-[11px] uppercase tracking-widest font-medium text-muted-foreground">Aprov.</th>
                  <th className="py-2.5 px-3 text-center text-[11px] uppercase tracking-widest font-medium text-muted-foreground">Taxa</th>
                  <th className="py-2.5 px-3 text-center text-[11px] uppercase tracking-widest font-medium text-muted-foreground">Pts</th>
                </tr>
              </thead>
              <tbody>
                {filteredRanking.map((r, i) => {
                  const taxa = r.tentativas > 0 ? Math.round((r.aproveitados / r.tentativas) * 100) : 0;
                  const isMe = r.corretor_id === user?.id;
                  const isTop1 = i === 0;
                  const isTop2 = i === 1;
                  const isTop3 = i === 2;
                  const profile = profileMap[r.corretor_id];
                  const level = getLevel(r.pontos);

                  const rowClass = isMe
                    ? "bg-primary/5 border-l-2 border-l-primary"
                    : isTop1
                    ? "bg-amber-50 dark:bg-amber-500/5 border-l-3 border-l-amber-500"
                    : isTop2
                    ? "bg-slate-50 dark:bg-slate-500/5 border-l-3 border-l-slate-400"
                    : isTop3
                    ? "bg-orange-50 dark:bg-orange-500/5 border-l-3 border-l-orange-400"
                    : "hover:bg-muted/50";

                  const levelColors: Record<string, { bg: string; text: string; border: string }> = {
                    iniciante: { bg: "rgba(156,163,175,0.15)", text: "#6B7280", border: "rgba(156,163,175,0.3)" },
                    ativo: { bg: "rgba(34,197,94,0.12)", text: "#16a34a", border: "rgba(34,197,94,0.3)" },
                    engajado: { bg: "rgba(249,115,22,0.12)", text: "#ea580c", border: "rgba(249,115,22,0.3)" },
                    destaque: { bg: "rgba(245,158,11,0.12)", text: "#d97706", border: "rgba(245,158,11,0.3)" },
                    elite: { bg: "rgba(59,130,246,0.12)", text: "#2563eb", border: "rgba(59,130,246,0.3)" },
                    lendario: { bg: "rgba(168,85,247,0.12)", text: "#9333ea", border: "rgba(168,85,247,0.3)" },
                  };
                  const lc = levelColors[level.id] || levelColors.iniciante;

                  const posIcon = isTop1 ? "🏆" : isTop2 ? "🥈" : isTop3 ? "🥉" : null;

                  return (
                    <tr
                      key={r.corretor_id}
                      className={`border-b border-border/50 transition-colors ${rowClass}`}
                    >
                      <td className="py-2.5 px-3">
                        {posIcon ? (
                          <span className="text-base">{posIcon}</span>
                        ) : (
                          <span className="text-sm font-bold w-5 text-center inline-block text-muted-foreground">{i + 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={r.nome}
                              className={`shrink-0 rounded-full object-cover w-9 h-9 border-2 ${
                                isTop1 ? "border-amber-500" : "border-border"
                              }`}
                            />
                          ) : (
                            <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-full bg-muted text-muted-foreground text-xs font-bold">
                              {getInitials(r.nome)}
                            </div>
                          )}
                          <span className={`truncate ${isTop1 ? "font-semibold text-amber-700 dark:text-amber-400" : isMe ? "font-semibold text-foreground" : "text-foreground"}`}>
                            {r.nome}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              Você
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1"
                          style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}
                        >
                          {level.emoji} {level.label}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-center font-bold ${r.tentativas > 0 ? "text-blue-600" : "text-muted-foreground"}`}>{r.tentativas}</td>
                      <td className={`py-2.5 px-3 text-center font-semibold ${r.aproveitados > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{r.aproveitados}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getTaxaColor(taxa)} ${getTaxaBorder(taxa)}`}>
                          {taxa}%
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-center font-bold ${r.pontos > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{r.pontos}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
