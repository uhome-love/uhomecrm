import { useMemo } from "react";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { useAuth } from "@/hooks/useAuth";
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
      <div className="py-12 text-center text-gray-400 rounded-2xl" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
        <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sem dados de oferta ativa para o período</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Phone, label: "Total Tentativas", value: totalTentativas, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: ThumbsUp, label: "Interessados", value: totals.aproveitados, color: "text-green-600", bg: "bg-green-50" },
          { icon: TrendingUp, label: "Taxa Conversão", value: `${taxaGeral}%`, color: "text-purple-600", bg: "bg-purple-50" },
          { icon: Flame, label: "Total Pontos", value: totals.pontos, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="rounded-2xl p-4 bg-white transition-all duration-200 hover:-translate-y-0.5"
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.bg} mb-2`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <p className={`text-4xl font-black leading-none ${kpi.color}`}>{kpi.value}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Podium */}
      {podiumEntries.length >= 3 && (
        <div
          className="rounded-[20px] overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #F8FAFF 0%, #EFF6FF 100%)",
            border: "1px solid rgba(59,130,246,0.1)",
          }}
        >
          <RankingPodium entries={podiumEntries} />
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden bg-white"
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid #F3F4F6" }}>
                <th className="py-2.5 px-3 text-left w-10 text-xs text-gray-400 uppercase tracking-wide font-medium">#</th>
                <th className="py-2.5 px-3 text-left text-xs text-gray-400 uppercase tracking-wide font-medium">Corretor</th>
                <th className="py-2.5 px-3 text-center text-xs text-gray-400 uppercase tracking-wide font-medium">Título</th>
                <th className="py-2.5 px-3 text-center text-xs text-gray-400 uppercase tracking-wide font-medium">Ligações</th>
                <th className="py-2.5 px-3 text-center text-xs text-gray-400 uppercase tracking-wide font-medium">Aprov.</th>
                <th className="py-2.5 px-3 text-center text-xs text-gray-400 uppercase tracking-wide font-medium">Taxa</th>
                <th className="py-2.5 px-3 text-center text-xs text-gray-400 uppercase tracking-wide font-medium">Pts</th>
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
                    className="transition-colors"
                    style={{
                      background: isMe ? "#EFF6FF" : "transparent",
                      borderLeft: isMe ? "3px solid #3B82F6" : "3px solid transparent",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                    onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td className="py-3 px-3">
                      {i === 0 ? <span className="text-lg" style={{ color: "#F59E0B" }}>👑</span>
                        : i === 1 ? <span className="text-base">🥈</span>
                        : i === 2 ? <span className="text-base">🥉</span>
                        : <span className="text-sm text-gray-400 font-bold">{i + 1}</span>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center rounded-full shrink-0 text-xs font-bold"
                          style={{
                            width: 32, height: 32,
                            background: "#F3F4F6",
                            color: "#6B7280",
                          }}
                        >
                          {getInitials(r.nome)}
                        </div>
                        <span className="font-semibold text-gray-800 truncate">{r.nome}</span>
                        {isMe && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: "#DBEAFE", color: "#2563EB" }}
                          >
                            ← você
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${level.color}`} style={{ background: "rgba(0,0,0,0.04)" }}>
                        {level.emoji} {level.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-blue-600">{r.tentativas}</td>
                    <td className="py-3 px-3 text-center font-bold text-green-600">{r.aproveitados}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: taxa >= 15 ? "#16A34A" : taxa >= 8 ? "#7C3AED" : "#6B7280",
                          background: taxa >= 15 ? "rgba(22,163,74,0.08)" : taxa >= 8 ? "rgba(124,58,237,0.08)" : "rgba(0,0,0,0.04)",
                        }}
                      >
                        {taxa}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-black text-amber-600">{r.pontos}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
