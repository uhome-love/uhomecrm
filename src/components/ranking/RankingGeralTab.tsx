import { useMemo } from "react";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { useCeoData, type CeoPeriod } from "@/hooks/useCeoData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Loader2, Star, Phone, ClipboardList, DollarSign } from "lucide-react";
import { getLevel } from "@/lib/gamification";
import RankingPodium, { type PodiumEntry } from "./RankingPodium";
import RankingExplanation from "./RankingExplanation";
import { useEffect, useState } from "react";

const medals = ["👑", "🥈", "🥉"];
const periodMap: Record<string, string> = { hoje: "dia", semana: "semana", mes: "mes" };

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

interface GestaoRow {
  corretor_id: string;
  corretor_nome: string;
  pontos_total: number;
  tentativas: number;
  leads_responderam: number;
  visitas_marcadas: number;
  propostas: number;
}

interface CombinedEntry {
  corretor_id: string;
  nome: string;
  oa_pts: number;
  gestao_pts: number;
  vgv_pts: number;
  score_geral: number;
  oa_rank: number;
  gestao_rank: number;
  vgv_rank: number;
}

// Weights
const PESO_OA = 10;
const PESO_GESTAO = 20;
const PESO_VGV = 100;
const TOTAL_PESO = PESO_OA + PESO_GESTAO + PESO_VGV;

function normalize(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map(v => (v / max) * 100);
}

export default function RankingGeralTab({ period }: { period: "hoje" | "semana" | "mes" }) {
  const { user } = useAuth();
  const { isCorretor } = useUserRole();
  const [corretorGerenteId, setCorretorGerenteId] = useState<string | undefined>();

  useEffect(() => {
    if (isCorretor && user?.id) {
      supabase
        .from("team_members")
        .select("gerente_id")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => { if (data) setCorretorGerenteId(data.gerente_id); });
    }
  }, [isCorretor, user?.id]);

  // 1) OA data
  const { ranking: oaRanking, isLoading: oaLoading } = useOARanking(period);

  // 2) Gestão data
  const { data: gestaoRanking = [], isLoading: gestaoLoading } = useQuery({
    queryKey: ["ranking-gestao-leads-geral", period],
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

  // 3) VGV data
  const filterGerenteId = isCorretor ? corretorGerenteId : undefined;
  const { allCorretores, loading: vgvLoading } = useCeoData((periodMap[period] || "dia") as CeoPeriod, undefined, undefined, filterGerenteId);

  const isLoading = oaLoading || gestaoLoading || vgvLoading;

  // Combine all into ranking geral
  const combined = useMemo<CombinedEntry[]>(() => {
    // Collect all unique corretor IDs
    const map = new Map<string, { nome: string; oa: number; gestao: number; vgv: number }>();

    oaRanking.forEach(r => {
      map.set(r.corretor_id, { nome: r.nome, oa: r.pontos, gestao: 0, vgv: 0 });
    });

    gestaoRanking.forEach(r => {
      const existing = map.get(r.corretor_id);
      if (existing) {
        existing.gestao = Number(r.pontos_total);
      } else {
        map.set(r.corretor_id, { nome: r.corretor_nome, oa: 0, gestao: Number(r.pontos_total), vgv: 0 });
      }
    });

    allCorretores.forEach(c => {
      const existing = map.get(c.corretor_id);
      if (existing) {
        existing.vgv = c.real_vgv_assinado;
      } else {
        map.set(c.corretor_id, { nome: c.corretor_nome, oa: 0, gestao: 0, vgv: c.real_vgv_assinado });
      }
    });

    const entries = Array.from(map.entries());
    if (entries.length === 0) return [];

    // Normalize each dimension
    const oaValues = entries.map(([, v]) => v.oa);
    const gestaoValues = entries.map(([, v]) => v.gestao);
    const vgvValues = entries.map(([, v]) => v.vgv);

    const oaNorm = normalize(oaValues);
    const gestaoNorm = normalize(gestaoValues);
    const vgvNorm = normalize(vgvValues);

    // Calculate ranks for each dimension
    const oaSorted = [...entries].sort((a, b) => b[1].oa - a[1].oa);
    const gestaoSorted = [...entries].sort((a, b) => b[1].gestao - a[1].gestao);
    const vgvSorted = [...entries].sort((a, b) => b[1].vgv - a[1].vgv);

    const oaRankMap = new Map(oaSorted.map(([id], i) => [id, i + 1]));
    const gestaoRankMap = new Map(gestaoSorted.map(([id], i) => [id, i + 1]));
    const vgvRankMap = new Map(vgvSorted.map(([id], i) => [id, i + 1]));

    const result: CombinedEntry[] = entries.map(([id, v], i) => {
      const scoreGeral = Math.round(
        (oaNorm[i] * PESO_OA + gestaoNorm[i] * PESO_GESTAO + vgvNorm[i] * PESO_VGV) / TOTAL_PESO
      );

      return {
        corretor_id: id,
        nome: v.nome,
        oa_pts: v.oa,
        gestao_pts: v.gestao,
        vgv_pts: v.vgv,
        score_geral: scoreGeral,
        oa_rank: oaRankMap.get(id) || 999,
        gestao_rank: gestaoRankMap.get(id) || 999,
        vgv_rank: vgvRankMap.get(id) || 999,
      };
    });

    result.sort((a, b) => b.score_geral - a.score_geral);
    return result;
  }, [oaRanking, gestaoRanking, allCorretores]);

  // Fetch avatars
  const corretorIds = useMemo(() => combined.map(c => c.corretor_id), [combined]);
  const { data: avatarMap = {} } = useQuery({
    queryKey: ["ranking-avatars-geral", corretorIds],
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

  const podiumEntries: PodiumEntry[] = useMemo(() => {
    return combined.slice(0, 3).map(c => ({
      id: c.corretor_id,
      nome: c.nome,
      value: `${c.score_geral}pts`,
      points: c.score_geral,
      avatarGamificadoUrl: avatarMap[c.corretor_id]?.gamificado || null,
      avatarUrl: avatarMap[c.corretor_id]?.avatar || null,
      isMe: c.corretor_id === user?.id,
    }));
  }, [combined, user?.id, avatarMap]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (combined.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground rounded-xl border border-dashed border-border">
        <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sem dados para o período</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <RankingExplanation
        titulo="Como funciona o Ranking Geral?"
        descricao="Combina 3 categorias com pesos diferentes para uma nota final de 0 a 100"
        corDestaque="text-amber-500"
        criterios={[
          {
            label: "Oferta Ativa",
            peso: `${PESO_OA}`,
            desc: "Pontos por ligações realizadas, aproveitamentos e taxa de conversão nas sessões de prospecção.",
          },
          {
            label: "Gestão de Leads",
            peso: `${PESO_GESTAO}`,
            desc: "Pontos por tentativas de contato, leads que responderam, visitas marcadas e propostas enviadas no CRM.",
          },
          {
            label: "VGV (Vendas)",
            peso: `${PESO_VGV}`,
            desc: "Volume Geral de Vendas assinado — o fator mais determinante. Quem vende mais, pontua mais.",
          },
          {
            label: "Cálculo da Nota",
            desc: `Cada categoria é normalizada de 0 a 100 (relativo ao melhor do time). A nota final é a média ponderada: (OA×${PESO_OA} + Gestão×${PESO_GESTAO} + VGV×${PESO_VGV}) ÷ ${TOTAL_PESO}.`,
          },
        ]}
      />

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Phone, label: "Peso Oferta Ativa", value: `${PESO_OA}`, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: ClipboardList, label: "Peso Gestão", value: `${PESO_GESTAO}`, color: "text-purple-600", bg: "bg-purple-50" },
          { icon: DollarSign, label: "Peso VGV", value: `${PESO_VGV}`, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="rounded-xl p-3 bg-card border border-border"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Podium */}
      {podiumEntries.length >= 3 && (
        <div
          className="rounded-[20px] overflow-hidden"
          style={{
            background: "linear-gradient(180deg, hsl(var(--accent)) 0%, hsl(var(--card)) 100%)",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <RankingPodium entries={podiumEntries} />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden bg-card border border-border shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2.5 px-3 text-left w-10 text-xs text-muted-foreground font-medium">#</th>
                <th className="py-2.5 px-3 text-left text-xs text-muted-foreground font-medium">Corretor</th>
                <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">
                  <span className="hidden sm:inline">Oferta Ativa</span>
                  <span className="sm:hidden">OA</span>
                </th>
                <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">
                  <span className="hidden sm:inline">Gestão</span>
                  <span className="sm:hidden">Gest.</span>
                </th>
                <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">VGV</th>
                <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">
                  <Star className="h-3.5 w-3.5 inline text-amber-500" /> Nota
                </th>
              </tr>
            </thead>
            <tbody>
              {combined.map((c, i) => {
                const isMe = c.corretor_id === user?.id;
                const level = getLevel(c.score_geral);
                const av = avatarMap[c.corretor_id];
                const imgSrc = av?.gamificado || av?.avatar;

                return (
                  <tr
                    key={c.corretor_id}
                    className={`border-b border-border transition-colors hover:bg-accent/30 ${isMe ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                  >
                    <td className="py-2.5 px-3">
                      {i < 3 ? <span className="text-base">{medals[i]}</span> : <span className="text-sm text-muted-foreground font-bold">{i + 1}</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-accent">
                          {imgSrc ? (
                            <img src={imgSrc} alt={c.nome} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">{getInitials(c.nome)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium truncate block text-foreground">{c.nome}</span>
                          <span className={`text-[10px] font-semibold ${level.color}`}>{level.emoji} {level.label}</span>
                        </div>
                        {isMe && <span className="text-[10px] text-primary font-medium shrink-0">← você</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="text-xs">
                        <span className="font-semibold text-blue-600">{c.oa_pts}pts</span>
                        <span className="block text-[10px] text-muted-foreground">#{c.oa_rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="text-xs">
                        <span className="font-semibold text-purple-600">{c.gestao_pts}pts</span>
                        <span className="block text-[10px] text-muted-foreground">#{c.gestao_rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="text-xs">
                        <span className="font-semibold text-emerald-600">
                          {c.vgv_pts >= 1_000_000 ? `${(c.vgv_pts / 1_000_000).toFixed(1)}M` : c.vgv_pts >= 1_000 ? `${(c.vgv_pts / 1_000).toFixed(0)}k` : c.vgv_pts}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">#{c.vgv_rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-lg font-black text-amber-600">{c.score_geral}</span>
                      <span className="text-[10px] text-muted-foreground">/100</span>
                    </td>
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
