import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDateFilter } from "@/contexts/DateFilterContext";
import GlobalDateFilterBar from "@/components/GlobalDateFilterBar";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { todayBRT, formatBRLCompact } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface CorretorProd {
  user_id: string;
  nome: string;
  ligacoes: number;
  aproveitados: number;
  taxa: number;
  roleta: number;
  descartados: number;
  followups: number;
  atualizados: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  negocios: number;
  propostas: number;
  assinados: number;
  vgv: number;
  pontos: number;
}

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
  profileId: string | null;
}

type Period = "dia" | "ontem" | "semana" | "mes";

function getPeriodRange(period: Period) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  if (period === "ontem") {
    const yesterday = format(subDays(now, 1), "yyyy-MM-dd");
    return { start: yesterday, end: yesterday, startTs: `${yesterday}T00:00:00-03:00`, endTs: `${yesterday}T23:59:59.999-03:00` };
  }
  if (period === "dia") return { start: todayStr, end: todayStr, startTs: `${todayStr}T00:00:00-03:00`, endTs: `${todayStr}T23:59:59.999-03:00` };
  if (period === "semana") {
    const s = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const e = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return { start: s, end: e, startTs: `${s}T00:00:00-03:00`, endTs: `${e}T23:59:59.999-03:00` };
  }
  const s = format(startOfMonth(now), "yyyy-MM-dd");
  const e = format(endOfMonth(now), "yyyy-MM-dd");
  return { start: s, end: e, startTs: `${s}T00:00:00-03:00`, endTs: `${e}T23:59:59.999-03:00` };
}

export default function TabProducao({ teamUserIds, teamNameMap, profileId }: Props) {
  const { user } = useAuth();
  const { period: globalPeriod } = useDateFilter();
  const period: Period = globalPeriod === "ontem" ? "ontem" : globalPeriod === "semana" ? "semana" : globalPeriod === "mes" || globalPeriod === "ultimos_30d" ? "mes" : "dia";
  const [rows, setRows] = useState<CorretorProd[]>([]);
  const [loading, setLoading] = useState(true);

  const { start, end, startTs, endTs } = useMemo(() => getPeriodRange(period), [period]);

  const loadData = useCallback(async () => {
    if (!user || teamUserIds.length === 0 || !profileId) return;
    setLoading(true);

    // Step 1: Build user_id → profile_id map (needed for tables that use profiles.id)
    const profilesRes = await supabase.from("profiles").select("id, user_id").in("user_id", teamUserIds);
    const profilesList = profilesRes.data || [];
    const userToProfile: Record<string, string> = {};
    const profileToUser: Record<string, string> = {};
    profilesList.forEach(p => {
      userToProfile[p.user_id] = p.id;
      profileToUser[p.id] = p.user_id;
    });
    const teamProfileIds = profilesList.map(p => p.id);

    // Step 2: Parallel queries using correct ID type per table
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      // Oferta ativa — corretor_id = user_id ✅
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, pontos").in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs),
      // Visitas — corretor_id = user_id (confirmed from DB)
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).gte("data_visita", start).lte("data_visita", end),
      // Negócios — corretor_id = profiles.id — fetch ALL active + period lost for counting
      supabase.from("negocios").select("corretor_id, fase, vgv_estimado, vgv_final, data_assinatura, created_at, fase_changed_at").in("corretor_id", teamProfileIds),
      // Follow-ups — responsavel_id = user_id ✅
      supabase.from("pipeline_tarefas").select("responsavel_id").in("responsavel_id", teamUserIds).gte("concluida_em", startTs).lte("concluida_em", endTs),
      // Roleta — corretor_id = user_id ✅
      supabase.from("distribuicao_historico").select("corretor_id").in("corretor_id", teamUserIds).eq("acao", "aceito").gte("created_at", startTs).lte("created_at", endTs),
      // Descartados — corretor_id = user_id, use arquivado = true (no status column)
      supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).eq("arquivado", true).gte("updated_at", startTs).lte("updated_at", endTs),
      // Leads atualizados — corretor_id = user_id
      supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).gte("ultima_acao_at", startTs).lte("ultima_acao_at", endTs),
    ]);

    const tentativas = r1.data || [];
    const visitas = r2.data || [];
    const negocios = r3.data || [];
    const followups = r4.data || [];
    const roleta = r5.data || [];
    const descartados = r6.data || [];
    const atualizados = r7.data || [];

    const stats: Record<string, CorretorProd> = {};
    teamUserIds.forEach(uid => {
      stats[uid] = {
        user_id: uid,
        nome: teamNameMap[uid] || "Corretor",
        ligacoes: 0, aproveitados: 0, taxa: 0,
        roleta: 0, descartados: 0, followups: 0, atualizados: 0,
        visitas_marcadas: 0, visitas_realizadas: 0,
        negocios: 0, propostas: 0, assinados: 0, vgv: 0, pontos: 0,
      };
    });

    tentativas.forEach(t => {
      if (!stats[t.corretor_id]) return;
      stats[t.corretor_id].ligacoes++;
      stats[t.corretor_id].pontos += t.pontos || 0;
      if (t.resultado === "com_interesse") stats[t.corretor_id].aproveitados++;
    });

    // Visitas — corretor_id = user_id (no mapping needed)
    visitas.forEach(v => {
      if (!v.corretor_id || !stats[v.corretor_id]) return;
      if (v.status !== "cancelada") stats[v.corretor_id].visitas_marcadas++;
      if (v.status === "realizada") stats[v.corretor_id].visitas_realizadas++;
    });

    // Negócios — period-filtered metrics
    negocios.forEach(n => {
      if (!n.corretor_id) return;
      const uid = profileToUser[n.corretor_id];
      if (!uid || !stats[uid]) return;

      // Negóc. = created in period
      if (n.created_at && n.created_at >= startTs && n.created_at <= endTs) {
        stats[uid].negocios++;
      }
      // Prop. = fase_changed_at in period AND currently proposta
      if (n.fase === "proposta" && n.fase_changed_at && n.fase_changed_at >= startTs && n.fase_changed_at <= endTs) {
        stats[uid].propostas++;
      }
      // Assin. = data_assinatura in period AND fase assinado/vendido
      if ((n.fase === "assinado" || n.fase === "vendido") && n.data_assinatura && n.data_assinatura >= start && n.data_assinatura <= end) {
        stats[uid].assinados++;
        stats[uid].vgv += Number(n.vgv_final || n.vgv_estimado || 0);
      }
    });

    followups.forEach(f => {
      const uid = (f as any).responsavel_id;
      if (!uid || !stats[uid]) return;
      stats[uid].followups++;
    });

    roleta.forEach(r => {
      if (!r.corretor_id || !stats[r.corretor_id]) return;
      stats[r.corretor_id].roleta++;
    });

    descartados.forEach(d => {
      if (!d.corretor_id || !stats[d.corretor_id]) return;
      stats[d.corretor_id].descartados++;
    });

    atualizados.forEach(a => {
      if (!a.corretor_id || !stats[a.corretor_id]) return;
      stats[a.corretor_id].atualizados++;
    });

    Object.values(stats).forEach(s => {
      s.taxa = s.ligacoes > 0 ? Math.round((s.aproveitados / s.ligacoes) * 100) : 0;
    });

    const sorted = Object.values(stats).sort((a, b) => b.pontos - a.pontos);
    setRows(sorted);
    setLoading(false);
  }, [user, teamUserIds, teamNameMap, profileId, start, end, startTs, endTs]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const { totais, media } = useMemo(() => {
    if (rows.length === 0) return { totais: null, media: null };
    const n = rows.length;
    const sum = (key: keyof CorretorProd) => rows.reduce((s, r) => s + (r[key] as number), 0);
    const totalLig = sum("ligacoes");
    const totalAprov = sum("aproveitados");
    const t = {
      ligacoes: totalLig, aproveitados: totalAprov,
      taxa: totalLig > 0 ? Math.round((totalAprov / totalLig) * 100) : 0,
      roleta: sum("roleta"), descartados: sum("descartados"), followups: sum("followups"), atualizados: sum("atualizados"),
      visitas_marcadas: sum("visitas_marcadas"), visitas_realizadas: sum("visitas_realizadas"),
      negocios: sum("negocios"), propostas: sum("propostas"), assinados: sum("assinados"),
      vgv: sum("vgv"), pontos: sum("pontos"),
    };
    const avg = (v: number) => Math.round(v / n);
    const m = {
      ligacoes: avg(t.ligacoes), aproveitados: avg(t.aproveitados), taxa: avg(t.taxa),
      roleta: avg(t.roleta), descartados: avg(t.descartados), followups: avg(t.followups), atualizados: avg(t.atualizados),
      visitas_marcadas: avg(t.visitas_marcadas), visitas_realizadas: avg(t.visitas_realizadas),
      negocios: avg(t.negocios), propostas: avg(t.propostas), assinados: avg(t.assinados),
      vgv: avg(t.vgv), pontos: avg(t.pontos),
    };
    return { totais: t, media: m };
  }, [rows]);

  const cellColor = (val: number, avg: number) => {
    if (avg === 0 && val === 0) return "text-muted-foreground";
    if (val > avg) return "text-emerald-600 font-bold";
    if (val < avg) return "text-destructive font-bold";
    return "font-medium";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const thBase = "py-2 px-2 text-center text-[11px] font-semibold whitespace-nowrap";
  const tdBase = "py-2 px-2 text-center text-xs";

  return (
    <div className="space-y-4">
      <GlobalDateFilterBar />

      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* Group header row */}
                <tr className="border-b border-border">
                  <th className="bg-muted/30" colSpan={2} />
                  <th colSpan={3} className="py-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-r border-border">
                    Oferta Ativa
                  </th>
                  <th colSpan={4} className="py-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border-r border-border">
                    Pipeline de Leads
                  </th>
                  <th colSpan={2} className="py-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border-r border-border">
                    Visitas
                  </th>
                  <th colSpan={4} className="py-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border-r border-border">
                    Pipeline Negócios
                  </th>
                  <th className="bg-muted/30" />
                </tr>
                {/* Column header row */}
                <tr className="border-b border-border bg-muted/20">
                  <th className={`${thBase} text-left text-muted-foreground`}>#</th>
                  <th className={`${thBase} text-left text-muted-foreground`}>Corretor</th>
                  {/* Oferta Ativa */}
                  <th className={`${thBase} text-blue-600 bg-blue-50/50`}>Lig</th>
                  <th className={`${thBase} text-blue-600 bg-blue-50/50`}>Aprov</th>
                  <th className={`${thBase} text-blue-600 bg-blue-50/50 border-r border-border`}>Taxa</th>
                  {/* Pipeline Leads */}
                  <th className={`${thBase} text-emerald-600 bg-emerald-50/50`}>Roleta</th>
                  <th className={`${thBase} text-emerald-600 bg-emerald-50/50`}>Descart.</th>
                  <th className={`${thBase} text-emerald-600 bg-emerald-50/50`}>Follow</th>
                  <th className={`${thBase} text-emerald-600 bg-emerald-50/50 border-r border-border`}>Atualiz.</th>
                  {/* Visitas */}
                  <th className={`${thBase} text-amber-600 bg-amber-50/50`}>V.Marc</th>
                  <th className={`${thBase} text-amber-600 bg-amber-50/50 border-r border-border`}>V.Real</th>
                  {/* Pipeline Negócios */}
                  <th className={`${thBase} text-purple-600 bg-purple-50/50`}>Negóc.</th>
                  <th className={`${thBase} text-purple-600 bg-purple-50/50`}>Prop.</th>
                  <th className={`${thBase} text-purple-600 bg-purple-50/50`}>Assin.</th>
                  <th className={`${thBase} text-purple-600 bg-purple-50/50 border-r border-border`}>VGV</th>
                  {/* Pontos */}
                  <th className={`${thBase} text-foreground font-black`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.user_id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                    <td className="py-2 px-2 text-xs font-bold text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2 text-xs font-semibold text-foreground whitespace-nowrap">{r.nome.split(" ").slice(0, 2).join(" ")}</td>
                    {/* Oferta Ativa */}
                    <td className={`${tdBase} bg-blue-50/20 ${media ? cellColor(r.ligacoes, media.ligacoes) : ""}`}>{r.ligacoes}</td>
                    <td className={`${tdBase} bg-blue-50/20 ${media ? cellColor(r.aproveitados, media.aproveitados) : ""}`}>{r.aproveitados}</td>
                    <td className={`${tdBase} bg-blue-50/20 border-r border-border/30 ${media ? cellColor(r.taxa, media.taxa) : ""}`}>{r.taxa}%</td>
                    {/* Pipeline Leads */}
                    <td className={`${tdBase} bg-emerald-50/20 ${media ? cellColor(r.roleta, media.roleta) : ""}`}>{r.roleta}</td>
                    <td className={`${tdBase} bg-emerald-50/20 ${media ? cellColor(r.descartados, media.descartados) : ""}`}>{r.descartados}</td>
                    <td className={`${tdBase} bg-emerald-50/20 ${media ? cellColor(r.followups, media.followups) : ""}`}>{r.followups}</td>
                    <td className={`${tdBase} bg-emerald-50/20 border-r border-border/30 ${media ? cellColor(r.atualizados, media.atualizados) : ""}`}>{r.atualizados}</td>
                    {/* Visitas */}
                    <td className={`${tdBase} bg-amber-50/20 ${media ? cellColor(r.visitas_marcadas, media.visitas_marcadas) : ""}`}>{r.visitas_marcadas}</td>
                    <td className={`${tdBase} bg-amber-50/20 border-r border-border/30 ${media ? cellColor(r.visitas_realizadas, media.visitas_realizadas) : ""}`}>{r.visitas_realizadas}</td>
                    {/* Pipeline Negócios */}
                    <td className={`${tdBase} bg-purple-50/20 ${media ? cellColor(r.negocios, media.negocios) : ""}`}>{r.negocios}</td>
                    <td className={`${tdBase} bg-purple-50/20 ${media ? cellColor(r.propostas, media.propostas) : ""}`}>{r.propostas}</td>
                    <td className={`${tdBase} bg-purple-50/20 ${media ? cellColor(r.assinados, media.assinados) : ""}`}>{r.assinados}</td>
                    <td className={`${tdBase} bg-purple-50/20 border-r border-border/30 ${media ? cellColor(r.vgv, media.vgv) : ""}`}>{formatBRLCompact(r.vgv)}</td>
                    {/* Pontos */}
                    <td className={`${tdBase} font-black ${media ? cellColor(r.pontos, media.pontos) : ""}`}>{r.pontos}</td>
                  </tr>
                ))}
                {totais && (
                  <tr className="bg-muted/50 border-t-2 border-primary/20">
                    <td className="py-2 px-2 text-xs font-bold text-primary" colSpan={2}>Total do time</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-blue-50/30">{totais.ligacoes}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-blue-50/30">{totais.aproveitados}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-blue-50/30 border-r border-border/30">{totais.taxa}%</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-emerald-50/30">{totais.roleta}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-emerald-50/30">{totais.descartados}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-emerald-50/30">{totais.followups}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-emerald-50/30 border-r border-border/30">{totais.atualizados}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-amber-50/30">{totais.visitas_marcadas}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-amber-50/30 border-r border-border/30">{totais.visitas_realizadas}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-purple-50/30">{totais.negocios}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-purple-50/30">{totais.propostas}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-purple-50/30">{totais.assinados}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold text-primary bg-purple-50/30 border-r border-border/30">{formatBRLCompact(totais.vgv)}</td>
                    <td className="py-2 px-2 text-center text-xs font-black text-primary">{totais.pontos}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={16} className="py-2 px-3 text-xs text-muted-foreground text-center">
                    ℹ️ Pontuação: Ligação = 1pt · Lead atualizado = 1pt · Follow-up = 2pts · Visita marcada = 3pts · Visita realizada = 5pts · Produzindo ≥ 10pts &nbsp;&nbsp;&nbsp; 🟢 Verde = acima da média do time · 🔴 Vermelho = abaixo da média ou zero
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
