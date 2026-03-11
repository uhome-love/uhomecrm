/**
 * RankingEficienciaTab — Eficiência Comercial (Peso 10%)
 * Mede taxas de conversão: lead→visita, visita→negócio
 */

import { useMemo } from "react";
import { useCeoData, type CeoPeriod } from "@/hooks/useCeoData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Zap, ArrowRight } from "lucide-react";
import { getLevel } from "@/lib/gamification";
import RankingPodium, { type PodiumEntry } from "./RankingPodium";
import { useEffect, useState } from "react";

const medals = ["👑", "🥈", "🥉"];
const periodMap: Record<string, CeoPeriod> = { hoje: "dia", semana: "semana", mes: "mes", trimestre: "mes" };

function getInitials(nome: string) {
  return nome.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

interface EficienciaEntry {
  corretor_id: string;
  nome: string;
  visitas: number;
  negocios: number;
  leads: number;
  taxa_lead_visita: number;
  taxa_visita_negocio: number;
  score: number;
}

export default function RankingEficienciaTab({ period }: { period: "hoje" | "semana" | "mes" | "trimestre" }) {
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

  const filterGerenteId = isCorretor ? corretorGerenteId : undefined;
  const { allCorretores, loading } = useCeoData(periodMap[period] || "dia", undefined, undefined, filterGerenteId);

  // Compute efficiency scores
  const sorted = useMemo<EficienciaEntry[]>(() => {
    const entries: EficienciaEntry[] = allCorretores.map(c => {
      const ligacoes = c.real_ligacoes;
      const visitas = c.real_visitas_realizadas;
      const propostas = c.real_propostas;
      const negocios = c.real_vgv_assinado > 0 ? 1 : 0;

      const taxa_lead_visita = ligacoes > 0 ? (visitas / ligacoes) * 100 : 0;
      const taxa_visita_negocio = visitas > 0 ? ((propostas + negocios) / visitas) * 100 : 0;

      // Weighted average: 40% lig→visita + 60% visita→negócio
      const rawScore = taxa_lead_visita * 0.4 + taxa_visita_negocio * 0.6;

      return {
        corretor_id: c.corretor_id,
        nome: c.corretor_nome,
        visitas,
        negocios: propostas + negocios,
        leads: ligacoes,
        taxa_lead_visita: Math.round(taxa_lead_visita * 10) / 10,
        taxa_visita_negocio: Math.round(taxa_visita_negocio * 10) / 10,
        score: rawScore,
      };
    });

    // Normalize scores relative to best (0-100)
    const maxScore = Math.max(...entries.map(e => e.score), 1);
    entries.forEach(e => { e.score = Math.round((e.score / maxScore) * 100); });

    return entries.sort((a, b) => b.score - a.score);
  }, [allCorretores]);

  // Fetch avatars
  const corretorIds = useMemo(() => sorted.map(c => c.corretor_id), [sorted]);
  const { data: avatarMap = {} } = useQuery({
    queryKey: ["ranking-avatars-eficiencia", corretorIds],
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
    return sorted.slice(0, 3).map(c => ({
      id: c.corretor_id,
      nome: c.nome,
      value: `${c.score}pts`,
      points: c.score,
      avatarGamificadoUrl: avatarMap[c.corretor_id]?.gamificado || null,
      avatarUrl: avatarMap[c.corretor_id]?.avatar || null,
      isMe: c.corretor_id === user?.id,
    }));
  }, [sorted, user?.id, avatarMap]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (sorted.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground rounded-xl border border-dashed border-border">
        <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Sem dados de eficiência para o período</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs text-muted-foreground">Lead → Visita</span>
          </div>
          <p className="text-2xl font-black text-blue-600">
            {sorted.length > 0 ? `${(sorted.reduce((s, e) => s + e.taxa_lead_visita, 0) / sorted.length).toFixed(1)}%` : "0%"}
          </p>
          <p className="text-[10px] text-muted-foreground">Média do time</p>
        </div>
        <div className="rounded-xl p-4 bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-50">
              <ArrowRight className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground">Visita → Negócio</span>
          </div>
          <p className="text-2xl font-black text-emerald-600">
            {sorted.length > 0 ? `${(sorted.reduce((s, e) => s + e.taxa_visita_negocio, 0) / sorted.length).toFixed(1)}%` : "0%"}
          </p>
          <p className="text-[10px] text-muted-foreground">Média do time</p>
        </div>
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
                 <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">Ligações</th>
                 <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">Visitas</th>
                 <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium" title="40% do score">Lig→Vis</th>
                 <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium" title="60% do score">Vis→Neg</th>
                 <th className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => {
                const isMe = c.corretor_id === user?.id;
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
                        <span className="font-medium truncate text-foreground">{c.nome}</span>
                        {isMe && <span className="text-[10px] text-primary font-medium shrink-0">← você</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{c.leads}</td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{c.visitas}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-xs font-semibold ${c.taxa_lead_visita >= 20 ? "text-emerald-600" : c.taxa_lead_visita >= 10 ? "text-blue-600" : "text-muted-foreground"}`}>
                        {c.taxa_lead_visita}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-xs font-semibold ${c.taxa_visita_negocio >= 30 ? "text-emerald-600" : c.taxa_visita_negocio >= 15 ? "text-purple-600" : "text-muted-foreground"}`}>
                        {c.taxa_visita_negocio}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-lg font-black text-amber-600">{c.score}</span>
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
