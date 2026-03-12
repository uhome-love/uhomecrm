import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayBRT } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, CheckCircle2, XCircle, Clock, Trophy, ArrowUpRight, Users } from "lucide-react";

type Period = "dia" | "semana" | "mes";

interface Props {
  /** null = all (CEO view), string[] = specific team user IDs (Gerente view) */
  teamUserIds: string[] | null;
  teamNameMap?: Record<string, string>;
  period?: Period;
  /** Show period selector */
  showPeriodSelector?: boolean;
  /** Compact mode for KPI card embedding */
  compact?: boolean;
}

const periodLabels: Record<Period, string> = { dia: "Hoje", semana: "Esta Semana", mes: "Este Mês" };

function getPeriodRange(period: Period) {
  const now = new Date();
  const today = todayBRT();
  if (period === "dia") return { start: `${today}T00:00:00`, end: `${today}T23:59:59.999` };
  if (period === "semana") {
    const s = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const e = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return { start: `${s}T00:00:00`, end: `${e}T23:59:59.999` };
  }
  const s = format(startOfMonth(now), "yyyy-MM-dd");
  const e = format(endOfMonth(now), "yyyy-MM-dd");
  return { start: `${s}T00:00:00`, end: `${e}T23:59:59.999` };
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
}

export default function LeadsDistribuidosPanel({ teamUserIds, teamNameMap, period: externalPeriod, showPeriodSelector = true, compact = false }: Props) {
  const [internalPeriod, setInternalPeriod] = useState<Period>("dia");
  const period = externalPeriod ?? internalPeriod;
  const { start, end } = useMemo(() => getPeriodRange(period), [period]);

  // Fetch actual distributed leads from pipeline_leads (source of truth)
  const { data, isLoading } = useQuery({
    queryKey: ["distribuicao-leads", teamUserIds?.join(",") ?? "all", period],
    queryFn: async () => {
      // Get leads distributed in the period (roleta_distribuido_em is the real distribution timestamp)
      let query = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, corretor_id, aceite_status, distribuido_em, aceito_em, created_at")
        .not("distribuido_em", "is", null)
        .gte("distribuido_em", start)
        .lte("distribuido_em", end)
        .order("distribuido_em", { ascending: false });

      if (teamUserIds && teamUserIds.length > 0) {
        query = query.in("corretor_id", teamUserIds);
      }

      const { data: leadsData } = await query;

      // Also fetch distribution history for tempo_resposta data
      let histQuery = supabase
        .from("distribuicao_historico")
        .select("id, corretor_id, acao, tempo_resposta_seg, created_at, pipeline_lead_id")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (teamUserIds && teamUserIds.length > 0) {
        histQuery = histQuery.in("corretor_id", teamUserIds);
      }

      const { data: histData } = await histQuery;

      // Get profiles for names/avatars
      const corretorIds = [...new Set((leadsData || []).map(l => l.corretor_id).filter(Boolean))];
      let profiles: any[] = [];
      if (corretorIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("user_id, nome, avatar_url, avatar_gamificado_url").in("user_id", corretorIds);
        profiles = p || [];
      }

      return { leads: leadsData || [], historico: histData || [], profiles };
    },
    staleTime: 30_000,
  });

  const distributedLeads = data?.leads || [];
  const historico = data?.historico || [];
  const profiles = data?.profiles || [];

  const profileMap = useMemo(() => {
    const m: Record<string, any> = {};
    profiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  // Build tempo map from historico (best response time per lead for the actual corretor)
  const tempoMap = useMemo(() => {
    const m: Record<string, number> = {};
    historico.forEach(h => {
      if (h.tempo_resposta_seg && h.tempo_resposta_seg > 0) {
        const key = h.pipeline_lead_id;
        if (!m[key] || h.tempo_resposta_seg < m[key]) {
          m[key] = h.tempo_resposta_seg;
        }
      }
    });
    return m;
  }, [historico]);

  // Aggregate per corretor using actual pipeline data
  const corretorStats = useMemo(() => {
    const stats: Record<string, { distribuidos: number; aceitos: number; rejeitados: number; pendentes: number; tempos: number[] }> = {};

    distributedLeads.forEach(l => {
      const cid = l.corretor_id;
      if (!cid) return;
      if (!stats[cid]) stats[cid] = { distribuidos: 0, aceitos: 0, rejeitados: 0, pendentes: 0, tempos: [] };
      const s = stats[cid];
      s.distribuidos++;
      if (l.aceite_status === "aceito") s.aceitos++;
      else if (l.aceite_status === "rejeitado" || l.aceite_status === "devolvido") s.rejeitados++;
      else s.pendentes++;
      const tempo = tempoMap[l.id];
      if (tempo) s.tempos.push(tempo);
    });

    return Object.entries(stats)
      .map(([corretor_id, s]) => {
        const nome = profileMap[corretor_id]?.nome || teamNameMap?.[corretor_id] || "Corretor";
        const avatar = profileMap[corretor_id]?.avatar_gamificado_url || profileMap[corretor_id]?.avatar_url;
        const tempoMedio = s.tempos.length > 0 ? Math.round(s.tempos.reduce((a, b) => a + b, 0) / s.tempos.length) : null;
        return { corretor_id, nome, avatar, ...s, tempoMedio };
      })
      .sort((a, b) => b.distribuidos - a.distribuidos);
  }, [distributedLeads, profileMap, teamNameMap, tempoMap]);

  // Totals
  const totals = useMemo(() => ({
    distribuidos: distributedLeads.length,
    aceitos: distributedLeads.filter(l => l.aceite_status === "aceito").length,
    rejeitados: distributedLeads.filter(l => l.aceite_status === "rejeitado" || l.aceite_status === "devolvido").length,
  }), [distributedLeads]);

  // Daily chart data
  const dailyData = useMemo(() => {
    const now = new Date();
    let interval: Date[];
    if (period === "dia") interval = [now];
    else if (period === "semana") interval = eachDayOfInterval({ start: startOfWeek(now, { weekStartsOn: 1 }), end: now });
    else interval = eachDayOfInterval({ start: startOfMonth(now), end: now });

    const dayCounts: Record<string, number> = {};
    interval.forEach(d => { dayCounts[format(d, "yyyy-MM-dd")] = 0; });
    distributedLeads.forEach(l => {
      const day = l.distribuido_em?.slice(0, 10);
      if (day && dayCounts[day] !== undefined) dayCounts[day]++;
    });

    return Object.entries(dayCounts).map(([date, count]) => ({
      date,
      label: format(parseISO(date), "dd/MM"),
      count,
    }));
  }, [distributedLeads, period]);

  const maxDayCount = Math.max(...dailyData.map(d => d.count), 1);

  function formatTempo(seg: number | null) {
    if (!seg) return "—";
    if (seg < 60) return `${seg}s`;
    return `${Math.floor(seg / 60)}min ${seg % 60}s`;
  }

  if (compact) {
    return (
      <div className="text-center">
        <p className="text-3xl font-black leading-none text-orange-500">{totals.distribuidos}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {totals.aceitos} aceitos · {totals.rejeitados} rejeitados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period selector */}
      {showPeriodSelector && !externalPeriod && (
        <div className="flex items-center gap-1 bg-accent/50 rounded-lg p-0.5 w-fit">
          {(["dia", "semana", "mes"] as Period[]).map(p => (
            <button key={p}
              onClick={() => setInternalPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >{periodLabels[p]}</button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/60">
              <CardContent className="p-3 text-center">
                <Send className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-orange-500">{totals.distribuidos}</p>
                <p className="text-[10px] text-muted-foreground">Distribuídos</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-3 text-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-emerald-500">{totals.aceitos}</p>
                <p className="text-[10px] text-muted-foreground">Aceitos</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-3 text-center">
                <XCircle className="h-4 w-4 text-destructive mx-auto mb-1" />
                <p className="text-2xl font-black text-destructive">{totals.rejeitados}</p>
                <p className="text-[10px] text-muted-foreground">Rejeitados</p>
              </CardContent>
            </Card>
          </div>

          {/* Mini bar chart */}
          {dailyData.length > 1 && (
            <Card className="border-border/60">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-foreground mb-2">📊 Distribuição por dia</p>
                <div className="flex items-end gap-1 h-16">
                  {dailyData.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[8px] text-muted-foreground">{d.count > 0 ? d.count : ""}</span>
                      <div
                        className="w-full bg-orange-500/80 rounded-t-sm transition-all"
                        style={{ height: `${Math.max(2, (d.count / maxDayCount) * 48)}px` }}
                      />
                      <span className="text-[8px] text-muted-foreground">{d.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ranking per corretor */}
          <Card className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-semibold text-foreground">Ranking por Corretor</p>
              </div>
              {corretorStats.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma distribuição no período</p>
              ) : (
                <div className="space-y-1.5">
                  {corretorStats.map((c, i) => (
                    <div key={c.corretor_id} className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border/30">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                      </span>
                      <Avatar className="h-7 w-7 shrink-0">
                        {c.avatar && <img src={c.avatar} alt={c.nome} className="h-full w-full rounded-full object-cover" />}
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(c.nome)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{c.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{c.distribuidos} dist</span>
                          <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-600">{c.aceitos} ✓</Badge>
                          {c.rejeitados > 0 && <Badge variant="outline" className="text-[9px] h-4 border-destructive/30 text-destructive">{c.rejeitados} ✗</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTempo(c.tempoMedio)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed lead table */}
          <Card className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-blue-500" />
                <p className="text-xs font-semibold text-foreground">Leads Distribuídos</p>
                <Badge variant="outline" className="text-[10px]">{distributedLeads.length}</Badge>
              </div>
              {distributedLeads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum lead distribuído no período</p>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Lead</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Empreendimento</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Corretor</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Tempo</th>
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributedLeads.slice(0, 50).map(l => {
                        const profile = profileMap[l.corretor_id || ""];
                        const corretorNome = profile?.nome || teamNameMap?.[l.corretor_id || ""] || "—";
                        const isAceito = l.aceite_status === "aceito";
                        const isRejeitado = l.aceite_status === "rejeitado" || l.aceite_status === "devolvido";
                        const tempo = tempoMap[l.id] || null;

                        return (
                          <tr key={l.id} className="border-b border-border/30 hover:bg-accent/20">
                            <td className="py-1.5 px-2 font-medium text-foreground">{l.nome || "—"}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{l.empreendimento || "—"}</td>
                            <td className="py-1.5 px-2 text-foreground">{corretorNome.split(" ")[0]}</td>
                            <td className="py-1.5 px-2">
                              <Badge variant="outline" className={`text-[9px] ${isAceito ? "border-emerald-300 text-emerald-600" : isRejeitado ? "border-destructive/30 text-destructive" : "border-amber-300 text-amber-600"}`}>
                                {isAceito ? "✓ Aceito" : isRejeitado ? "✗ Rejeitado" : "⏳ Pendente"}
                              </Badge>
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground">{formatTempo(tempo)}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">
                              {l.distribuido_em ? format(new Date(l.distribuido_em), "dd/MM HH:mm") : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {distributedLeads.length > 50 && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">Mostrando 50 de {distributedLeads.length} registros</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
