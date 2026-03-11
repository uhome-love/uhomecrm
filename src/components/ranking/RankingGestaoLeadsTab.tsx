import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle, Clock, TrendingUp, Loader2 } from "lucide-react";
import { getLevel } from "@/lib/gamification";
import RankingPodium, { type PodiumEntry } from "./RankingPodium";

const medals = ["👑", "🥈", "🥉"];
const periodMap: Record<string, string> = { hoje: "dia", semana: "semana", mes: "mes" };

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

interface GestaoRow {
  corretor_id: string;
  corretor_nome: string;
  pontos_total: number;
  contatos: number;
  qualificados: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  propostas: number;
}

export default function RankingGestaoLeadsTab({ period }: { period: "hoje" | "semana" | "mes" }) {
  const { user } = useAuth();

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["ranking-gestao-leads", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking_gestao_leads", {
        p_periodo: periodMap[period] || "dia",
      });
      if (error) throw error;
      return (data || []) as GestaoRow[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Fetch avatars
  const corretorIds = useMemo(() => ranking.map(r => r.corretor_id), [ranking]);
  const { data: avatarMap = {} } = useQuery({
    queryKey: ["ranking-avatars-gestao", corretorIds],
    queryFn: async () => {
      if (corretorIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, avatar_gamificado_url, avatar_url")
        .in("user_id", corretorIds);
      const map: Record<string, { gamificado: string | null; avatar: string | null }> = {};
      (data || []).forEach(p => {
        map[p.user_id] = { gamificado: p.avatar_gamificado_url, avatar: p.avatar_url };
      });
      return map;
    },
    enabled: corretorIds.length > 0,
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    return ranking.reduce(
      (acc, r) => ({
        contatos: acc.contatos + Number(r.contatos),
        qualificados: acc.qualificados + Number(r.qualificados),
        visitas: acc.visitas + Number(r.visitas_marcadas) + Number(r.visitas_realizadas),
        propostas: acc.propostas + Number(r.propostas),
        pontos: acc.pontos + Number(r.pontos_total),
      }),
      { contatos: 0, qualificados: 0, visitas: 0, propostas: 0, pontos: 0 }
    );
  }, [ranking]);

  const podiumEntries: PodiumEntry[] = useMemo(() => {
    return ranking.slice(0, 3).map(r => ({
      id: r.corretor_id,
      nome: r.corretor_nome,
      value: `${r.pontos_total}pts`,
      points: Number(r.pontos_total),
      avatarGamificadoUrl: avatarMap[r.corretor_id]?.gamificado || null,
      avatarUrl: avatarMap[r.corretor_id]?.avatar || null,
      isMe: r.corretor_id === user?.id,
    }));
  }, [ranking, user?.id, avatarMap]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (ranking.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sem dados de gestão de leads para o período</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: ClipboardList, label: "Contatos", value: totals.contatos, color: "text-primary" },
          { icon: CheckCircle, label: "Qualificados", value: totals.qualificados, color: "text-emerald-600" },
          { icon: TrendingUp, label: "Visitas", value: totals.visitas, color: "text-purple-600" },
          { icon: Clock, label: "Total Pontos", value: totals.pontos, color: "text-warning" },
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
                  <th className="py-2 px-3 text-center">Contatos</th>
                  <th className="py-2 px-3 text-center">Qualificados</th>
                  <th className="py-2 px-3 text-center">Visitas</th>
                  <th className="py-2 px-3 text-center">Propostas</th>
                  <th className="py-2 px-3 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const isMe = r.corretor_id === user?.id;
                  const level = getLevel(Number(r.pontos_total));
                  const av = avatarMap[r.corretor_id];
                  const imgSrc = av?.gamificado || av?.avatar;
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
                          <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "#F3F4F6" }}>
                            {imgSrc ? (
                              <img src={imgSrc} alt={r.corretor_nome} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold text-gray-500">{getInitials(r.corretor_nome)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{r.corretor_nome}</span>
                            <span className={`text-[10px] font-semibold ${level.color}`}>{level.emoji} {level.label}</span>
                          </div>
                          {isMe && <span className="text-[10px] text-primary font-medium">← você</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">{r.contatos}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">{r.qualificados}</td>
                      <td className="py-2.5 px-3 text-center">{r.visitas_marcadas}</td>
                      <td className="py-2.5 px-3 text-center text-purple-600 font-semibold">{r.propostas}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-primary">{r.pontos_total}</td>
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
