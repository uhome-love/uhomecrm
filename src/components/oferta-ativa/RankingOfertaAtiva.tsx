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

// Dynamic team color palette
const PALETTE = [
  { bg: "rgba(34,197,94,0.15)", text: "#4ADE80", border: "rgba(34,197,94,0.3)" },   // green
  { bg: "rgba(59,130,246,0.15)", text: "#60A5FA", border: "rgba(59,130,246,0.3)" },  // blue
  { bg: "rgba(168,85,247,0.15)", text: "#C084FC", border: "rgba(168,85,247,0.3)" },  // purple
  { bg: "rgba(251,191,36,0.15)", text: "#FBBF24", border: "rgba(251,191,36,0.3)" },  // amber
  { bg: "rgba(244,63,94,0.15)", text: "#FB7185", border: "rgba(244,63,94,0.3)" },    // rose
  { bg: "rgba(20,184,166,0.15)", text: "#2DD4BF", border: "rgba(20,184,166,0.3)" },  // teal
];

export default function RankingOfertaAtiva() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const [teamFilter, setTeamFilter] = useState<string>("todos");
  const { ranking, totalTentativas, isLoading } = useOARanking(period);

  // Fetch gerente info + profiles (avatar, gamification) for each corretor
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
    staleTime: 60_000,
  });

  const { data: teamMap = {} } = useQuery({
    queryKey: ["oa-ranking-teams", corretorIds],
    queryFn: async () => {
      if (corretorIds.length === 0) return {};
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, gerente_id")
        .in("user_id", corretorIds)
        .eq("status", "ativo");

      const gerenteIds = [...new Set((members || []).map(m => m.gerente_id).filter(Boolean))];
      
      const gerenteNameMap: Record<string, string> = {};
      if (gerenteIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", gerenteIds);
        for (const p of profiles || []) {
          const firstName = p.nome?.split(" ")[0] || "Equipe";
          gerenteNameMap[p.user_id] = `Equipe ${firstName}`;
        }
      }

      const result: Record<string, string> = {};
      for (const m of members || []) {
        if (m.user_id && m.gerente_id) {
          result[m.user_id] = gerenteNameMap[m.gerente_id] || "Equipe";
        }
      }
      return result;
    },
    enabled: corretorIds.length > 0,
    staleTime: 60_000,
  });

  // Build team color map dynamically
  const teamColorMap = useMemo(() => {
    const uniqueTeams = [...new Set(Object.values(teamMap))].sort();
    const map: Record<string, typeof PALETTE[0]> = {};
    uniqueTeams.forEach((team, i) => {
      map[team] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [teamMap]);

  const uniqueTeams = useMemo(() => [...new Set(Object.values(teamMap))].sort(), [teamMap]);

  // Filtered ranking
  const filteredRanking = useMemo(() => {
    if (teamFilter === "todos") return ranking;
    return ranking.filter(r => teamMap[r.corretor_id] === teamFilter);
  }, [ranking, teamFilter, teamMap]);

  const totals = useMemo(() => {
    return filteredRanking.reduce(
      (acc, c) => ({
        tentativas: acc.tentativas + c.tentativas,
        aproveitados: acc.aproveitados + c.aproveitados,
        pontos: acc.pontos + c.pontos,
      }),
      { tentativas: 0, aproveitados: 0, pontos: 0 }
    );
  }, [filteredRanking]);

  const taxaGeral = totals.tentativas > 0 ? Math.round((totals.aproveitados / totals.tentativas) * 100) : 0;

  const getInitials = (nome: string) =>
    nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const myEntry = filteredRanking.find(r => r.corretor_id === user?.id);
  const myIndex = filteredRanking.findIndex(r => r.corretor_id === user?.id);
  const myTaxa = myEntry && myEntry.tentativas > 0 ? Math.round((myEntry.aproveitados / myEntry.tentativas) * 100) : 0;

  const getTaxaColor = (taxa: number) => {
    if (taxa >= 15) return "#4ADE80";
    if (taxa >= 8) return "#FBBF24";
    return "#EF4444";
  };

  return (
    <div className="space-y-4" style={{ background: "#0A0F1E", minHeight: "100%" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" style={{ color: "#FBBF24" }} />
            <h2 className="font-bold text-lg" style={{ color: "#fff" }}>Ranking Oferta Ativa</h2>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
            {isAdmin ? "Visão completa da empresa" : "Ranking da sua equipe"}
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-2">
          {(["hoje", "semana", "mes"] as const).map(p => (
            <button
              key={p}
              className="text-xs px-4 py-1.5 font-medium transition-all"
              style={{
                borderRadius: 999,
                background: period === p ? "rgba(59,130,246,0.2)" : "transparent",
                color: period === p ? "#60A5FA" : "#9CA3AF",
                border: period === p ? "1px solid rgba(59,130,246,0.4)" : "1px solid transparent",
              }}
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
          <Filter className="h-3.5 w-3.5" style={{ color: "#6B7280" }} />
          <button
            className="text-[11px] px-3 py-1 font-medium transition-all"
            style={{
              borderRadius: 999,
              background: teamFilter === "todos" ? "rgba(255,255,255,0.1)" : "transparent",
              color: teamFilter === "todos" ? "#fff" : "#6B7280",
              border: teamFilter === "todos" ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
            }}
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
                className="text-[11px] px-3 py-1 font-medium transition-all"
                style={{
                  borderRadius: 999,
                  background: isActive ? tc.bg : "transparent",
                  color: isActive ? tc.text : "#6B7280",
                  border: isActive ? `1px solid ${tc.border}` : "1px solid transparent",
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
        <div
          className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(34,197,94,0.08))",
            border: "1px solid rgba(59,130,246,0.25)",
            borderRadius: 16,
          }}
        >
          <p className="text-xs uppercase font-medium mb-2" style={{ color: "#9CA3AF", letterSpacing: "0.1em" }}>
            Seu progresso
          </p>
          <p
            className="font-black text-5xl mb-4"
            style={{
              color: "#60A5FA",
              textShadow: "0 0 20px rgba(59,130,246,0.5)",
            }}
          >
            {myEntry.pontos} pts
          </p>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#6B7280" }}>Tentativas</p>
              <p className="font-black text-2xl" style={{ color: "#fff" }}>{myEntry.tentativas}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#6B7280" }}>Aproveitados</p>
              <p className="font-black text-2xl" style={{ color: "#4ADE80" }}>{myEntry.aproveitados}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#6B7280" }}>Taxa</p>
              <p className="font-black text-2xl" style={{ color: getTaxaColor(myTaxa) }}>{myTaxa}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#60A5FA" }} />
        </div>
      ) : filteredRanking.length === 0 ? (
        <div
          className="py-12 text-center rounded-2xl"
          style={{ background: "#1C2128", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" style={{ color: "#FBBF24" }} />
          <p className="text-sm" style={{ color: "#6B7280" }}>Sem dados de oferta ativa para o período selecionado</p>
        </div>
      ) : (
        <div
          className="overflow-hidden"
          style={{
            background: "#1C2128",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
          }}
        >
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Trophy className="h-4 w-4" style={{ color: "#FBBF24" }} />
            <span className="text-xs font-semibold uppercase" style={{ color: "#9CA3AF", letterSpacing: "0.1em" }}>
              Ranking por Pontos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#0A0F1E", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="py-2.5 px-3 text-left w-10" style={{ color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>#</th>
                  <th className="py-2.5 px-3 text-left" style={{ color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Corretor</th>
                  <th className="py-2.5 px-3 text-left" style={{ color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Título</th>
                  <th className="py-2.5 px-3 text-center" style={{ color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Ligações</th>
                  <th className="py-2.5 px-3 text-center" style={{ color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Aprov.</th>
                  <th className="py-2.5 px-3 text-center" style={{ color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Taxa</th>
                  <th className="py-2.5 px-3 text-center" style={{ color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Pts</th>
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

                  let rowStyle: React.CSSProperties = {
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    transition: "background 0.15s",
                  };

                  if (isMe) {
                    rowStyle = { ...rowStyle, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" };
                  } else if (isTop1) {
                    rowStyle = { ...rowStyle, background: "rgba(245,158,11,0.05)", borderLeft: "3px solid #F59E0B" };
                  } else if (isTop2) {
                    rowStyle = { ...rowStyle, background: "rgba(148,163,184,0.03)", borderLeft: "3px solid #94A3B8" };
                  } else if (isTop3) {
                    rowStyle = { ...rowStyle, background: "rgba(205,127,50,0.03)", borderLeft: "3px solid #CD7F32" };
                  }

                  const posIcon = isTop1 ? "🏆" : isTop2 ? "🥈" : isTop3 ? "🥉" : null;
                  const nameColor = isMe ? "#fff" : isTop1 ? "#FBBF24" : "#D1D5DB";
                  const nameWeight = isMe || isTop1 ? 600 : 400;

                  // Level badge colors
                  const levelColors: Record<string, { bg: string; text: string; border: string }> = {
                    iniciante: { bg: "rgba(156,163,175,0.15)", text: "#9CA3AF", border: "rgba(156,163,175,0.3)" },
                    ativo: { bg: "rgba(34,197,94,0.15)", text: "#4ADE80", border: "rgba(34,197,94,0.3)" },
                    engajado: { bg: "rgba(249,115,22,0.15)", text: "#FB923C", border: "rgba(249,115,22,0.3)" },
                    destaque: { bg: "rgba(245,158,11,0.15)", text: "#FBBF24", border: "rgba(245,158,11,0.3)" },
                    elite: { bg: "rgba(59,130,246,0.15)", text: "#60A5FA", border: "rgba(59,130,246,0.3)" },
                    lendario: { bg: "rgba(168,85,247,0.15)", text: "#C084FC", border: "rgba(168,85,247,0.3)" },
                  };
                  const lc = levelColors[level.id] || levelColors.iniciante;

                  return (
                    <tr
                      key={r.corretor_id}
                      style={rowStyle}
                      onMouseEnter={e => {
                        if (!isMe && !isTop1 && !isTop2 && !isTop3)
                          (e.currentTarget.style.background = "rgba(255,255,255,0.03)");
                      }}
                      onMouseLeave={e => {
                        if (!isMe && !isTop1 && !isTop2 && !isTop3)
                          (e.currentTarget.style.background = "transparent");
                      }}
                    >
                      <td className="py-2.5 px-3">
                        {posIcon ? (
                          <span className="text-base">{posIcon}</span>
                        ) : (
                          <span className="text-sm font-bold w-5 text-center inline-block" style={{ color: "#6B7280" }}>{i + 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={r.nome}
                              className="shrink-0 rounded-full object-cover"
                              style={{ width: 36, height: 36, border: isTop1 ? "2px solid #F59E0B" : "2px solid rgba(255,255,255,0.1)" }}
                            />
                          ) : (
                            <div
                              className="flex items-center justify-center shrink-0"
                              style={{ width: 36, height: 36, borderRadius: "50%", background: "#374151", color: "#D1D5DB", fontSize: 12, fontWeight: 700 }}
                            >
                              {getInitials(r.nome)}
                            </div>
                          )}
                          <span className="truncate font-semibold" style={{ color: nameColor, fontWeight: nameWeight }}>
                            {r.nome}
                          </span>
                          {isMe && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(59,130,246,0.2)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.3)" }}
                            >
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
                      <td className="py-2.5 px-3 text-center font-bold" style={{ color: r.tentativas > 0 ? "#60A5FA" : "#4B5563" }}>{r.tentativas}</td>
                      <td className="py-2.5 px-3 text-center font-semibold" style={{ color: r.aproveitados > 0 ? "#4ADE80" : "#4B5563" }}>{r.aproveitados}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: getTaxaColor(taxa),
                            border: `1px solid ${taxa >= 15 ? "rgba(34,197,94,0.3)" : taxa >= 8 ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.3)"}`,
                          }}
                        >
                          {taxa}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold" style={{ color: r.pontos > 0 ? "#F59E0B" : "#4B5563" }}>{r.pontos}</td>
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
