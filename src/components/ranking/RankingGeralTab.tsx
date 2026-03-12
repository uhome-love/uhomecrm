/**
 * RankingGeralTab — Gamified Combined Ranking
 * 
 * 4 Pillars with weighted scoring:
 * 1. Prospecção (20%) - ligações, aproveitados, taxa conversão OA
 * 2. Gestão de Leads (30%) - transitions in pipeline
 * 3. Vendas/VGV (40%) - VGV assinado
 * 4. Eficiência Comercial (10%) - conversion rates
 * 
 * Features:
 * - Position breakdown ("why you're here")
 * - Climb tips ("what to do to go up")
 * - Performance badges (best of period)
 * - Color-coded performance table
 */

import { useMemo, useEffect, useState } from "react";
import { useOARanking } from "@/hooks/useOfertaAtiva";
import { useCeoData, type CeoPeriod } from "@/hooks/useCeoData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Loader2, Star, Phone, ClipboardList, DollarSign, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getLevel } from "@/lib/gamification";
import RankingPodium, { type PodiumEntry } from "./RankingPodium";
import RankingPositionCard from "./RankingPositionCard";
import RankingPerformanceBadges, { computePerformanceBadges } from "./RankingPerformanceBadges";
import { motion } from "framer-motion";

const periodMap: Record<string, string> = { hoje: "dia", semana: "semana", mes: "mes", trimestre: "mes" };

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

interface CombinedEntry {
  corretor_id: string;
  nome: string;
  oa_pts: number;
  gestao_pts: number;
  vgv_valor: number;
  eficiencia_score: number;
  oa_norm: number;
  gestao_norm: number;
  vgv_norm: number;
  eficiencia_norm: number;
  score_geral: number;
  oa_rank: number;
  gestao_rank: number;
  vgv_rank: number;
  eficiencia_rank: number;
  // Extra for climb tips
  ligacoes: number;
  visitas: number;
  propostas: number;
}

const PESO_PROSPECCAO = 20;
const PESO_GESTAO = 30;
const PESO_VENDAS = 40;
const PESO_EFICIENCIA = 10;
const TOTAL_PESO = PESO_PROSPECCAO + PESO_GESTAO + PESO_VENDAS + PESO_EFICIENCIA;

function normalize(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map(v => (v / max) * 100);
}

/** Get performance color class based on normalized score */
function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  if (score >= 20) return "text-orange-500 dark:text-orange-400";
  return "text-muted-foreground";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-50 dark:bg-emerald-900/20";
  if (score >= 60) return "bg-blue-50 dark:bg-blue-900/20";
  if (score >= 40) return "bg-amber-50 dark:bg-amber-900/20";
  if (score >= 20) return "bg-orange-50 dark:bg-orange-900/20";
  return "bg-muted/30";
}

function getNotaColor(nota: number): string {
  if (nota >= 80) return "text-emerald-600";
  if (nota >= 60) return "text-blue-600";
  if (nota >= 40) return "text-amber-600";
  return "text-red-500";
}

export default function RankingGeralTab({ period }: { period: "hoje" | "semana" | "mes" | "trimestre" }) {
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

  // 1) OA data (Prospecção)
  const oaPeriod = period === "trimestre" ? "mes" : period;
  const { ranking: oaRanking, isLoading: oaLoading } = useOARanking(oaPeriod as "hoje" | "semana" | "mes");

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

  // 3) VGV + Eficiência data
  const filterGerenteId = isCorretor ? corretorGerenteId : undefined;
  const { allCorretores, loading: vgvLoading } = useCeoData((periodMap[period] || "dia") as CeoPeriod, undefined, undefined, filterGerenteId);

  const isLoading = oaLoading || gestaoLoading || vgvLoading;

  // Combine all into ranking geral with 4 pillars
  const combined = useMemo<CombinedEntry[]>(() => {
    const map = new Map<string, { nome: string; oa: number; gestao: number; vgv: number; ligacoes: number; visitas: number; propostas: number }>();

    oaRanking.forEach(r => {
      map.set(r.corretor_id, { nome: r.nome, oa: r.pontos, gestao: 0, vgv: 0, ligacoes: r.tentativas, visitas: 0, propostas: 0 });
    });

    gestaoRanking.forEach(r => {
      const existing = map.get(r.corretor_id);
      if (existing) {
        existing.gestao = Number(r.pontos_total);
      } else {
        map.set(r.corretor_id, { nome: r.corretor_nome, oa: 0, gestao: Number(r.pontos_total), vgv: 0, ligacoes: 0, visitas: 0, propostas: 0 });
      }
    });

    allCorretores.forEach(c => {
      const existing = map.get(c.corretor_id);
      if (existing) {
        existing.vgv = c.real_vgv_assinado;
        existing.visitas = c.real_visitas_realizadas;
        existing.propostas = c.real_propostas;
        if (!existing.ligacoes) existing.ligacoes = c.real_ligacoes;
      } else {
        map.set(c.corretor_id, { nome: c.corretor_nome, oa: 0, gestao: 0, vgv: c.real_vgv_assinado, ligacoes: c.real_ligacoes, visitas: c.real_visitas_realizadas, propostas: c.real_propostas });
      }
    });

    const entries = Array.from(map.entries());
    if (entries.length === 0) return [];

    const eficienciaScores = entries.map(([, v]) => {
      const taxaLeadVisita = v.ligacoes > 0 ? (v.visitas / v.ligacoes) * 100 : 0;
      const taxaVisitaNeg = v.visitas > 0 ? ((v.propostas + (v.vgv > 0 ? 1 : 0)) / v.visitas) * 100 : 0;
      return taxaLeadVisita * 0.4 + taxaVisitaNeg * 0.6;
    });

    const oaNorm = normalize(entries.map(([, v]) => v.oa));
    const gestaoNorm = normalize(entries.map(([, v]) => v.gestao));
    const vgvNorm = normalize(entries.map(([, v]) => v.vgv));
    const efNorm = normalize(eficienciaScores);

    const oaSorted = [...entries].sort((a, b) => b[1].oa - a[1].oa);
    const gestaoSorted = [...entries].sort((a, b) => b[1].gestao - a[1].gestao);
    const vgvSorted = [...entries].sort((a, b) => b[1].vgv - a[1].vgv);
    const efSorted = [...entries.map(([id], i) => ({ id, score: eficienciaScores[i] }))].sort((a, b) => b.score - a.score);

    const oaRankMap = new Map(oaSorted.map(([id], i) => [id, i + 1]));
    const gestaoRankMap = new Map(gestaoSorted.map(([id], i) => [id, i + 1]));
    const vgvRankMap = new Map(vgvSorted.map(([id], i) => [id, i + 1]));
    const efRankMap = new Map(efSorted.map((e, i) => [e.id, i + 1]));

    const result: CombinedEntry[] = entries.map(([id, v], i) => {
      const scoreGeral = Math.round(
        (oaNorm[i] * PESO_PROSPECCAO + gestaoNorm[i] * PESO_GESTAO + vgvNorm[i] * PESO_VENDAS + efNorm[i] * PESO_EFICIENCIA) / TOTAL_PESO
      );

      return {
        corretor_id: id,
        nome: v.nome,
        oa_pts: v.oa,
        gestao_pts: v.gestao,
        vgv_valor: v.vgv,
        eficiencia_score: Math.round(eficienciaScores[i] * 10) / 10,
        oa_norm: Math.round(oaNorm[i]),
        gestao_norm: Math.round(gestaoNorm[i]),
        vgv_norm: Math.round(vgvNorm[i]),
        eficiencia_norm: Math.round(efNorm[i]),
        score_geral: scoreGeral,
        oa_rank: oaRankMap.get(id) || 999,
        gestao_rank: gestaoRankMap.get(id) || 999,
        vgv_rank: vgvRankMap.get(id) || 999,
        eficiencia_rank: efRankMap.get(id) || 999,
        ligacoes: v.ligacoes,
        visitas: v.visitas,
        propostas: v.propostas,
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

  // Compute performance badges
  const performanceBadges = useMemo(() => computePerformanceBadges(combined), [combined]);

  // Find current user's position and compute climb tips
  const myEntry = useMemo(() => combined.find(c => c.corretor_id === user?.id), [combined, user?.id]);
  const myPosition = useMemo(() => {
    const idx = combined.findIndex(c => c.corretor_id === user?.id);
    return idx >= 0 ? idx + 1 : null;
  }, [combined, user?.id]);

  const climbTips = useMemo(() => {
    if (!myEntry || !myPosition || myPosition <= 1) return [];
    const above = combined[myPosition - 2]; // person above me
    if (!above) return [];

    const tips: { text: string; icon: React.ElementType }[] = [];
    const scoreDiff = above.score_geral - myEntry.score_geral;

    // Show specific actionable tips
    if (above.oa_pts > myEntry.oa_pts) {
      const diff = above.oa_pts - myEntry.oa_pts;
      tips.push({ text: `+${diff} pts em prospecção`, icon: Phone });
    }
    if (above.vgv_valor > myEntry.vgv_valor && myEntry.vgv_valor === 0) {
      tips.push({ text: "Fechar 1 venda", icon: DollarSign });
    } else if (above.vgv_valor > myEntry.vgv_valor) {
      const diff = above.vgv_valor - myEntry.vgv_valor;
      const fmtDiff = diff >= 1_000_000 ? `R$${(diff / 1_000_000).toFixed(1)}M` : `R$${(diff / 1_000).toFixed(0)}k`;
      tips.push({ text: `+${fmtDiff} em VGV`, icon: DollarSign });
    }
    if (above.visitas > myEntry.visitas) {
      tips.push({ text: `+${above.visitas - myEntry.visitas} visita(s) realizada(s)`, icon: TrendingUp });
    }
    if (above.gestao_pts > myEntry.gestao_pts) {
      const diff = above.gestao_pts - myEntry.gestao_pts;
      tips.push({ text: `+${diff} pts em gestão`, icon: ClipboardList });
    }

    // Limit to top 3 tips
    return tips.slice(0, 3);
  }, [myEntry, myPosition, combined]);

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

  const totalCorretores = combined.length;

  return (
    <div className="space-y-4">
      {/* 4 Pillar weight indicators - compact */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Phone, label: "Prospecção", peso: PESO_PROSPECCAO, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { icon: ClipboardList, label: "Gestão", peso: PESO_GESTAO, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { icon: DollarSign, label: "Vendas", peso: PESO_VENDAS, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { icon: Zap, label: "Eficiência", peso: PESO_EFICIENCIA, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-xl p-2.5 ${kpi.bg} border border-border`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              <span className="text-[10px] font-medium text-muted-foreground">{kpi.label}</span>
            </div>
            <p className={`text-xl font-black ${kpi.color}`}>{kpi.peso}%</p>
          </div>
        ))}
      </div>

      {/* Performance Badges */}
      <RankingPerformanceBadges badges={performanceBadges} currentUserId={user?.id} />

      {/* Podium */}
      {podiumEntries.length >= 3 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, hsl(var(--accent)) 0%, hsl(var(--card)) 100%)",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <RankingPodium entries={podiumEntries} />
        </div>
      )}

      {/* Position Card - "Why you're here" + "How to climb" */}
      {myEntry && myPosition && (
        <RankingPositionCard
          nome={myEntry.nome}
          posicao={myPosition}
          scoreGeral={myEntry.score_geral}
          pillarRanks={[
            { label: "Prospecção", rank: myEntry.oa_rank, total: totalCorretores, icon: Phone, color: "text-blue-600" },
            { label: "Gestão", rank: myEntry.gestao_rank, total: totalCorretores, icon: ClipboardList, color: "text-purple-600" },
            { label: "Vendas", rank: myEntry.vgv_rank, total: totalCorretores, icon: DollarSign, color: "text-emerald-600" },
            { label: "Eficiência", rank: myEntry.eficiencia_rank, total: totalCorretores, icon: Zap, color: "text-amber-600" },
          ]}
          climbTips={climbTips}
        />
      )}

      {/* Performance Table */}
      <div className="rounded-xl overflow-hidden bg-card border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-2.5 px-3 text-left w-10 text-xs text-muted-foreground font-medium">#</th>
                <th className="py-2.5 px-3 text-left text-xs text-muted-foreground font-medium">Corretor</th>
                <th className="py-2.5 px-2 text-center text-xs text-muted-foreground font-medium">
                  <Phone className="h-3 w-3 inline text-blue-500 mb-0.5" />
                  <span className="hidden sm:inline ml-1">Prosp.</span>
                </th>
                <th className="py-2.5 px-2 text-center text-xs text-muted-foreground font-medium">
                  <ClipboardList className="h-3 w-3 inline text-purple-500 mb-0.5" />
                  <span className="hidden sm:inline ml-1">Gestão</span>
                </th>
                <th className="py-2.5 px-2 text-center text-xs text-muted-foreground font-medium">
                  <DollarSign className="h-3 w-3 inline text-emerald-500 mb-0.5" />
                  <span className="hidden sm:inline ml-1">VGV</span>
                </th>
                <th className="py-2.5 px-2 text-center text-xs text-muted-foreground font-medium">
                  <Zap className="h-3 w-3 inline text-amber-500 mb-0.5" />
                  <span className="hidden sm:inline ml-1">Efic.</span>
                </th>
                <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">
                  <Star className="h-3.5 w-3.5 inline text-amber-500 mb-0.5" /> Nota
                </th>
              </tr>
            </thead>
            <tbody>
              {combined.map((c, i) => {
                const isMe = c.corretor_id === user?.id;
                const level = getLevel(c.score_geral);
                const av = avatarMap[c.corretor_id];
                const imgSrc = av?.gamificado || av?.avatar;
                const medals = ["👑", "🥈", "🥉"];

                return (
                  <motion.tr
                    key={c.corretor_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border-b border-border transition-colors hover:bg-accent/30 ${
                      isMe ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      {i < 3 ? (
                        <span className="text-base">{medals[i]}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground font-bold">{i + 1}</span>
                      )}
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
                          <span className="font-medium truncate block text-foreground text-xs">{c.nome}</span>
                          <span className={`text-[10px] font-semibold ${level.color}`}>{level.emoji} {level.label}</span>
                        </div>
                        {isMe && (
                          <span className="text-[9px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                            você
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Pillar scores with color coding */}
                    <td className="py-2.5 px-2 text-center">
                      <div className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded-md ${getScoreBg(c.oa_norm)}`}>
                        <span className={`text-xs font-bold ${getScoreColor(c.oa_norm)}`}>{c.oa_norm}</span>
                        <span className="text-[9px] text-muted-foreground">#{c.oa_rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded-md ${getScoreBg(c.gestao_norm)}`}>
                        <span className={`text-xs font-bold ${getScoreColor(c.gestao_norm)}`}>{c.gestao_norm}</span>
                        <span className="text-[9px] text-muted-foreground">#{c.gestao_rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded-md ${getScoreBg(c.vgv_norm)}`}>
                        <span className={`text-xs font-bold ${getScoreColor(c.vgv_norm)}`}>
                          {c.vgv_valor >= 1_000_000 ? `${(c.vgv_valor / 1_000_000).toFixed(1)}M` : c.vgv_valor >= 1_000 ? `${(c.vgv_valor / 1_000).toFixed(0)}k` : c.vgv_valor || "—"}
                        </span>
                        <span className="text-[9px] text-muted-foreground">#{c.vgv_rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded-md ${getScoreBg(c.eficiencia_norm)}`}>
                        <span className={`text-xs font-bold ${getScoreColor(c.eficiencia_norm)}`}>{c.eficiencia_norm}</span>
                        <span className="text-[9px] text-muted-foreground">#{c.eficiencia_rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-black ${getNotaColor(c.score_geral)}`}>{c.score_geral}</span>
                        <span className="text-[9px] text-muted-foreground">/100</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
