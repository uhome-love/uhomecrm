import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Phone, MapPin, FileText, DollarSign, TrendingUp, Target } from "lucide-react";

type Period = "semana" | "mes" | "custom";

interface AggRow {
  corretor_nome: string;
  meta_ligacoes: number; real_ligacoes: number;
  meta_visitas_marcadas: number; real_visitas_marcadas: number;
  meta_visitas_realizadas: number; real_visitas_realizadas: number;
  meta_propostas: number; real_propostas: number;
  meta_vgv_gerado: number; real_vgv_gerado: number;
  meta_vgv_assinado: number; real_vgv_assinado: number;
}

export default function CheckpointReports() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("semana");
  const [rows, setRows] = useState<AggRow[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "semana") return { start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
  }, [period]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: cps } = await supabase.from("checkpoints").select("id, data").eq("gerente_id", user.id).gte("data", dateRange.start).lte("data", dateRange.end);
    if (!cps || cps.length === 0) { setRows([]); setDailyData([]); setLoading(false); return; }

    const cpIds = cps.map((c: any) => c.id);
    const { data: lines } = await supabase.from("checkpoint_lines").select("*, team_members!checkpoint_lines_corretor_id_fkey(nome)").in("checkpoint_id", cpIds);
    const { data: team } = await supabase.from("team_members").select("id, nome").eq("gerente_id", user.id);

    // Aggregate per corretor
    const aggMap = new Map<string, AggRow>();
    for (const m of (team || [])) {
      aggMap.set(m.id, {
        corretor_nome: (m as any).nome,
        meta_ligacoes: 0, real_ligacoes: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0,
        meta_visitas_realizadas: 0, real_visitas_realizadas: 0, meta_propostas: 0, real_propostas: 0,
        meta_vgv_gerado: 0, real_vgv_gerado: 0, meta_vgv_assinado: 0, real_vgv_assinado: 0,
      });
    }

    for (const l of (lines || [])) {
      const agg = aggMap.get(l.corretor_id);
      if (!agg) continue;
      agg.meta_ligacoes += l.meta_ligacoes ?? 0;
      agg.real_ligacoes += l.real_ligacoes ?? 0;
      agg.meta_visitas_marcadas += l.meta_visitas_marcadas ?? 0;
      agg.real_visitas_marcadas += l.real_visitas_marcadas ?? 0;
      agg.meta_visitas_realizadas += l.meta_visitas_realizadas ?? 0;
      agg.real_visitas_realizadas += l.real_visitas_realizadas ?? 0;
      agg.meta_propostas += l.meta_propostas ?? 0;
      agg.real_propostas += l.real_propostas ?? 0;
      agg.meta_vgv_gerado += Number(l.meta_vgv_gerado ?? 0);
      agg.real_vgv_gerado += Number(l.real_vgv_gerado ?? 0);
      agg.meta_vgv_assinado += Number(l.meta_vgv_assinado ?? 0);
      agg.real_vgv_assinado += Number(l.real_vgv_assinado ?? 0);
    }
    setRows(Array.from(aggMap.values()));

    // Daily chart data
    const dailyMap = new Map<string, { data: string; visitas: number; propostas: number; vgv: number }>();
    for (const cp of cps) {
      dailyMap.set(cp.id, { data: cp.data, visitas: 0, propostas: 0, vgv: 0 });
    }
    for (const l of (lines || [])) {
      const day = dailyMap.get(l.checkpoint_id);
      if (!day) continue;
      day.visitas += l.real_visitas_realizadas ?? 0;
      day.propostas += l.real_propostas ?? 0;
      day.vgv += Number(l.real_vgv_assinado ?? 0);
    }
    setDailyData(Array.from(dailyMap.values()).sort((a, b) => a.data.localeCompare(b.data)).map(d => ({ ...d, data: format(new Date(d.data + "T12:00:00"), "dd/MM") })));

    setLoading(false);
  }, [user, dateRange]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const t = { meta_ligacoes: 0, real_ligacoes: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0, meta_visitas_realizadas: 0, real_visitas_realizadas: 0, meta_propostas: 0, real_propostas: 0, meta_vgv_gerado: 0, real_vgv_gerado: 0, meta_vgv_assinado: 0, real_vgv_assinado: 0 };
    for (const r of rows) {
      t.meta_ligacoes += r.meta_ligacoes; t.real_ligacoes += r.real_ligacoes;
      t.meta_visitas_marcadas += r.meta_visitas_marcadas; t.real_visitas_marcadas += r.real_visitas_marcadas;
      t.meta_visitas_realizadas += r.meta_visitas_realizadas; t.real_visitas_realizadas += r.real_visitas_realizadas;
      t.meta_propostas += r.meta_propostas; t.real_propostas += r.real_propostas;
      t.meta_vgv_gerado += r.meta_vgv_gerado; t.real_vgv_gerado += r.real_vgv_gerado;
      t.meta_vgv_assinado += r.meta_vgv_assinado; t.real_vgv_assinado += r.real_vgv_assinado;
    }
    return t;
  }, [rows]);

  const pct = (real: number, meta: number) => meta > 0 ? Math.round((real / meta) * 100) : 0;

  const cards = [
    { label: "Ligações", icon: Phone, meta: totals.meta_ligacoes, real: totals.real_ligacoes },
    { label: "Visitas Marcadas", icon: MapPin, meta: totals.meta_visitas_marcadas, real: totals.real_visitas_marcadas },
    { label: "Visitas Realizadas", icon: Target, meta: totals.meta_visitas_realizadas, real: totals.real_visitas_realizadas },
    { label: "Propostas", icon: FileText, meta: totals.meta_propostas, real: totals.real_propostas },
    { label: "VGV Gerado", icon: DollarSign, meta: totals.meta_vgv_gerado, real: totals.real_vgv_gerado, currency: true },
    { label: "VGV Assinado", icon: TrendingUp, meta: totals.meta_vgv_assinado, real: totals.real_vgv_assinado, currency: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{dateRange.start} a {dateRange.end}</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando relatórios...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Sem dados no período selecionado.</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((c) => {
              const p = pct(c.real, c.meta);
              return (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <c.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{c.label}</span>
                  </div>
                  <p className="text-xl font-display font-bold text-foreground">
                    {c.currency ? `R$ ${c.real.toLocaleString("pt-BR")}` : c.real}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(p, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-semibold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>{p}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Meta: {c.currency ? `R$ ${c.meta.toLocaleString("pt-BR")}` : c.meta}</p>
                </div>
              );
            })}
          </div>

          {/* Per-corretor table */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2 font-display font-semibold">Corretor</th>
                  <th className="px-2 py-2 text-center">Lig. %</th>
                  <th className="px-2 py-2 text-center">V.Marc %</th>
                  <th className="px-2 py-2 text-center">V.Real %</th>
                  <th className="px-2 py-2 text-center">Prop. %</th>
                  <th className="px-2 py-2 text-center">VGV Ger. %</th>
                  <th className="px-2 py-2 text-center">VGV Ass. %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.corretor_nome} className="border-b border-border hover:bg-muted/10">
                    <td className="px-3 py-2 font-medium">{r.corretor_nome}</td>
                    {[
                      pct(r.real_ligacoes, r.meta_ligacoes),
                      pct(r.real_visitas_marcadas, r.meta_visitas_marcadas),
                      pct(r.real_visitas_realizadas, r.meta_visitas_realizadas),
                      pct(r.real_propostas, r.meta_propostas),
                      pct(r.real_vgv_gerado, r.meta_vgv_gerado),
                      pct(r.real_vgv_assinado, r.meta_vgv_assinado),
                    ].map((p, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        <span className={`font-semibold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>{p}%</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Charts */}
          {dailyData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                <h4 className="font-display font-semibold text-sm mb-3">Visitas realizadas por dia</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                <h4 className="font-display font-semibold text-sm mb-3">Propostas por dia</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="propostas" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
