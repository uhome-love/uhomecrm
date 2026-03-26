import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDateFilter } from "@/contexts/DateFilterContext";
import GlobalDateFilterBar from "@/components/GlobalDateFilterBar";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { todayBRT, formatBRLCompact } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface CorretorProd {
  user_id: string;
  nome: string;
  ligacoes: number;
  aproveitados: number;
  taxa: number;
  oa_tentativas: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  followups: number;
  propostas: number;
  vendas: number;
  vgv: number;
  pontos: number;
}

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
  profileId: string | null;
}

type Period = "dia" | "semana" | "mes";

function getPeriodRange(period: Period) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
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
  const period: Period = globalPeriod === "semana" ? "semana" : globalPeriod === "mes" || globalPeriod === "ultimos_30d" ? "mes" : "dia";
  const [rows, setRows] = useState<CorretorProd[]>([]);
  const [loading, setLoading] = useState(true);

  const { start, end, startTs, endTs } = useMemo(() => getPeriodRange(period), [period]);

  const loadData = useCallback(async () => {
    if (!user || teamUserIds.length === 0 || !profileId) return;
    setLoading(true);

    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, pontos").in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs),
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).gte("data_visita", start).lte("data_visita", end),
      supabase.from("negocios").select("corretor_id, fase, vgv_estimado, vgv_final").eq("gerente_id", profileId).not("fase", "in", '("perdido","cancelado","distrato")'),
      // Follow-ups: count tasks completed in the period
      supabase.from("lead_tasks").select("user_id").in("user_id", teamUserIds).eq("status", "concluida").gte("concluida_em", startTs).lte("concluida_em", endTs),
      supabase.from("profiles").select("user_id, nome").in("user_id", teamUserIds),
    ]);

    const tentativas = r1.data || [];
    const visitas = r2.data || [];
    const negocios = r3.data || [];
    const followups = r4.data || [];

    const stats: Record<string, CorretorProd> = {};
    teamUserIds.forEach(uid => {
      stats[uid] = {
        user_id: uid,
        nome: teamNameMap[uid] || "Corretor",
        ligacoes: 0, aproveitados: 0, taxa: 0, oa_tentativas: 0,
        visitas_marcadas: 0, visitas_realizadas: 0,
        followups: 0, propostas: 0, vendas: 0, vgv: 0, pontos: 0,
      };
    });

    tentativas.forEach(t => {
      if (!stats[t.corretor_id]) return;
      stats[t.corretor_id].ligacoes++;
      stats[t.corretor_id].oa_tentativas++;
      stats[t.corretor_id].pontos += t.pontos || 0;
      if (t.resultado === "com_interesse") stats[t.corretor_id].aproveitados++;
    });

    visitas.forEach(v => {
      if (!v.corretor_id || !stats[v.corretor_id]) return;
      stats[v.corretor_id].visitas_marcadas++;
      if (v.status === "realizada") stats[v.corretor_id].visitas_realizadas++;
    });

    negocios.forEach(n => {
      if (!n.corretor_id || !stats[n.corretor_id]) return;
      if (n.fase === "proposta") stats[n.corretor_id].propostas++;
      if (n.fase === "assinado" || n.fase === "vendido") {
        stats[n.corretor_id].vendas++;
        stats[n.corretor_id].vgv += Number(n.vgv_final || n.vgv_estimado || 0);
      }
    });

    followups.forEach(f => {
      if (!f.user_id || !stats[f.user_id]) return;
      stats[f.user_id].followups++;
    });

    Object.values(stats).forEach(s => {
      s.taxa = s.ligacoes > 0 ? Math.round((s.aproveitados / s.ligacoes) * 100) : 0;
    });

    const sorted = Object.values(stats).sort((a, b) => b.pontos - a.pontos);
    setRows(sorted);
    setLoading(false);
  }, [user, teamUserIds, teamNameMap, profileId, start, end, startTs, endTs]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Média do time
  const media = useMemo(() => {
    if (rows.length === 0) return null;
    const n = rows.length;
    return {
      ligacoes: Math.round(rows.reduce((s, r) => s + r.ligacoes, 0) / n),
      aproveitados: Math.round(rows.reduce((s, r) => s + r.aproveitados, 0) / n),
      taxa: Math.round(rows.reduce((s, r) => s + r.taxa, 0) / n),
      oa_tentativas: Math.round(rows.reduce((s, r) => s + r.oa_tentativas, 0) / n),
      visitas_marcadas: Math.round(rows.reduce((s, r) => s + r.visitas_marcadas, 0) / n),
      visitas_realizadas: Math.round(rows.reduce((s, r) => s + r.visitas_realizadas, 0) / n),
      followups: Math.round(rows.reduce((s, r) => s + r.followups, 0) / n),
      propostas: Math.round(rows.reduce((s, r) => s + r.propostas, 0) / n),
      vendas: Math.round(rows.reduce((s, r) => s + r.vendas, 0) / n),
      vgv: Math.round(rows.reduce((s, r) => s + r.vgv, 0) / n),
      pontos: Math.round(rows.reduce((s, r) => s + r.pontos, 0) / n),
    };
  }, [rows]);

  const cellColor = (val: number, avg: number) => {
    if (avg === 0) return "";
    if (val > avg) return "text-emerald-600 font-bold";
    if (val < avg) return "text-destructive font-bold";
    return "";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <GlobalDateFilterBar />

      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-3 text-[11px] text-muted-foreground font-semibold">#</th>
                  <th className="text-left py-3 px-3 text-[11px] text-muted-foreground font-semibold">Corretor</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">Lig</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">Aprov</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">Taxa</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">OA Tent</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">V.Marc</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">V.Real</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">Follow</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">Prop</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">Vendas</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">VGV</th>
                  <th className="text-center py-3 px-3 text-[11px] text-muted-foreground font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.user_id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-bold text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-foreground">{r.nome.split(" ").slice(0, 2).join(" ")}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.ligacoes, media.ligacoes) : ""}`}>{r.ligacoes}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.aproveitados, media.aproveitados) : ""}`}>{r.aproveitados}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.taxa, media.taxa) : ""}`}>{r.taxa}%</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.oa_tentativas, media.oa_tentativas) : ""}`}>{r.oa_tentativas}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.visitas_marcadas, media.visitas_marcadas) : ""}`}>{r.visitas_marcadas}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.visitas_realizadas, media.visitas_realizadas) : ""}`}>{r.visitas_realizadas}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.followups, media.followups) : ""}`}>{r.followups}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.propostas, media.propostas) : ""}`}>{r.propostas}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.vendas, media.vendas) : ""}`}>{r.vendas}</td>
                    <td className={`py-2.5 px-3 text-center text-xs ${media ? cellColor(r.vgv, media.vgv) : ""}`}>{formatBRLCompact(r.vgv)}</td>
                    <td className={`py-2.5 px-3 text-center text-xs font-black ${media ? cellColor(r.pontos, media.pontos) : ""}`}>{r.pontos}</td>
                  </tr>
                ))}
                {/* Média do time */}
                {media && (
                  <tr className="bg-muted/50 border-t-2 border-primary/20">
                    <td className="py-2.5 px-3 text-xs font-bold text-primary" colSpan={2}>Média do time</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.ligacoes}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.aproveitados}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.taxa}%</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.oa_tentativas}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.visitas_marcadas}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.visitas_realizadas}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.followups}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.propostas}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{media.vendas}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-primary">{formatBRLCompact(media.vgv)}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-black text-primary">{media.pontos}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
