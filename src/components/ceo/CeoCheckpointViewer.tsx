import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Users, TrendingUp, Eye, AlertTriangle, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// Feriados nacionais brasileiros 2026
const FERIADOS_2026 = [
  "2026-01-01", // Confraternização Universal
  "2026-02-16", // Carnaval (segunda)
  "2026-02-17", // Carnaval (terça)
  "2026-04-03", // Sexta-feira Santa
  "2026-04-21", // Tiradentes
  "2026-05-01", // Dia do Trabalho
  "2026-06-04", // Corpus Christi
  "2026-09-07", // Independência
  "2026-10-12", // N.S. Aparecida
  "2026-11-02", // Finados
  "2026-11-15", // Proclamação da República
  "2026-12-25", // Natal
];

function isDiaUtil(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = dateObj.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // domingo ou sábado
  if (FERIADOS_2026.includes(dateStr)) return false;
  return true;
}
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchCheckpointSummary,
  fetchDailyOAStats,
  fetchDailyVisitasStats,
  resolveEffectiveMetrics,
  type CheckpointSummaryRow,
} from "@/lib/checkpointService";

interface GerenteCheckpoint {
  gerente_id: string;
  gerente_nome: string;
  checkpoint_status: string;
  lines: {
    auth_user_id: string;
    corretor_nome: string;
    meta_ligacoes: number;
    meta_leads: number;
    meta_visitas_marcadas: number;
    meta_presenca: string;
    obs_gerente: string;
    real_ligacoes: number | null;
    real_leads: number | null;
    real_visitas_marcadas: number | null;
    real_visitas_realizadas: number | null;
    real_propostas: number | null;
    obs_dia: string | null;
    status_dia: string | null;
  }[];
  totals: {
    meta_ligacoes: number;
    real_ligacoes: number;
    meta_leads: number;
    real_leads: number;
    meta_visitas_marcadas: number;
    real_visitas_marcadas: number;
    real_visitas_realizadas: number;
    real_propostas: number;
    presentes: number;
    ausentes: number;
    total: number;
  };
}

const statusColors: Record<string, string> = {
  OK: "bg-success/10 text-success border-success/30",
  "Atenção": "bg-warning/10 text-warning border-warning/30",
  "Crítico": "bg-destructive/10 text-destructive border-destructive/30",
};

export default function CeoCheckpointViewer() {
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [gerentesData, setGerentesData] = useState<GerenteCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGerente, setActiveGerente] = useState("consolidado");

  const dateLabel = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      return format(new Date(y, m - 1, d), "EEEE, dd 'de' MMMM", { locale: ptBR });
    } catch { return date; }
  })();

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Get all gestors
    const { data: gestorRoles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
    const gestorIds = (gestorRoles || []).map(r => r.user_id);
    if (gestorIds.length === 0) { setGerentesData([]); setLoading(false); return; }

    // 2. Get gestor names
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", gestorIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));

    // 3. Get checkpoint status via checkpoints table
    const { data: cps } = await supabase.from("checkpoints").select("id, gerente_id, status").eq("data", date).in("gerente_id", gestorIds);
    const cpStatusMap = new Map((cps || []).map(c => [c.gerente_id, c.status]));

    // 4. Use canonical checkpoint summary RPC — resolves ALL identity in SQL
    const summaryRows = await fetchCheckpointSummary(date);

    // 5. Get daily goals for metas (uses auth_user_id)
    const allUserIds = summaryRows.map(r => r.auth_user_id);
    const { data: goals } = allUserIds.length > 0
      ? await supabase
          .from("corretor_daily_goals")
          .select("corretor_id, meta_ligacoes, meta_aproveitados, meta_visitas_marcadas")
          .in("corretor_id", allUserIds)
          .eq("data", date)
      : { data: [] };
    const goalsMap = new Map((goals || []).map((g: any) => [g.corretor_id, g]));

    // Fallback to recent goals for missing
    const foundGoalIds = new Set((goals || []).map((g: any) => g.corretor_id));
    const missingGoalIds = allUserIds.filter(id => !foundGoalIds.has(id));
    if (missingGoalIds.length > 0) {
      const { data: recentGoals } = await supabase
        .from("corretor_daily_goals")
        .select("corretor_id, meta_ligacoes, meta_aproveitados, meta_visitas_marcadas, data")
        .in("corretor_id", missingGoalIds)
        .lte("data", date)
        .order("data", { ascending: false });
      const seenRecent = new Set<string>();
      for (const g of (recentGoals || []) as any[]) {
        if (seenRecent.has(g.corretor_id)) continue;
        seenRecent.add(g.corretor_id);
        goalsMap.set(g.corretor_id, g);
      }
    }

    // 6. Group by gerente_id
    const byGerente = new Map<string, CheckpointSummaryRow[]>();
    for (const row of summaryRows) {
      const arr = byGerente.get(row.gerente_id) || [];
      arr.push(row);
      byGerente.set(row.gerente_id, arr);
    }

    // 7. Build GerenteCheckpoint for each gestor
    const result: GerenteCheckpoint[] = gestorIds.map(gId => {
      const rows = byGerente.get(gId) || [];
      const lines = rows.map((row: any) => {
        const eff = resolveEffectiveMetrics(row);
        const goal = goalsMap.get(row.auth_user_id);
        const metaLig = row.meta_ligacoes > 0 ? row.meta_ligacoes : (goal?.meta_ligacoes ?? 0);
        const metaAprov = row.meta_aproveitados > 0 ? row.meta_aproveitados : (goal?.meta_aproveitados ?? 0);
        const metaVm = row.meta_visitas_marcar > 0 ? row.meta_visitas_marcar : ((goal as any)?.meta_visitas_marcadas ?? 0);
        const isAbsent = ["ausente", "atestado", "folga"].includes(row.presenca);

        return {
          auth_user_id: row.auth_user_id,
          corretor_nome: row.corretor_nome,
          meta_ligacoes: metaLig,
          meta_leads: metaAprov,
          meta_visitas_marcadas: metaVm,
          meta_presenca: isAbsent ? "falta" : "sim",
          obs_gerente: row.obs_gerente,
          real_ligacoes: eff.ligacoes > 0 ? eff.ligacoes : null,
          real_leads: eff.aproveitados > 0 ? eff.aproveitados : null,
          real_visitas_marcadas: eff.visitas_marcadas > 0 ? eff.visitas_marcadas : null,
          real_visitas_realizadas: eff.visitas_realizadas > 0 ? eff.visitas_realizadas : null,
          real_propostas: eff.propostas > 0 ? eff.propostas : null,
          obs_dia: row.obs_dia || null,
          status_dia: null as string | null,
        };
      });

      const totals = {
        meta_ligacoes: lines.reduce((s, l) => s + l.meta_ligacoes, 0),
        real_ligacoes: lines.reduce((s, l) => s + (l.real_ligacoes ?? 0), 0),
        meta_leads: lines.reduce((s, l) => s + l.meta_leads, 0),
        real_leads: lines.reduce((s, l) => s + (l.real_leads ?? 0), 0),
        meta_visitas_marcadas: lines.reduce((s, l) => s + l.meta_visitas_marcadas, 0),
        real_visitas_marcadas: lines.reduce((s, l) => s + (l.real_visitas_marcadas ?? 0), 0),
        real_visitas_realizadas: lines.reduce((s, l) => s + (l.real_visitas_realizadas ?? 0), 0),
        real_propostas: lines.reduce((s, l) => s + (l.real_propostas ?? 0), 0),
        presentes: lines.filter(l => l.meta_presenca !== "falta").length,
        ausentes: lines.filter(l => l.meta_presenca === "falta").length,
        total: lines.length,
      };

      return {
        gerente_id: gId,
        gerente_nome: profileMap.get(gId) || "Gerente",
        checkpoint_status: cpStatusMap.get(gId) || "não_criado",
        lines,
        totals,
      };
    });

    result.sort((a, b) => a.gerente_nome.localeCompare(b.gerente_nome));
    setGerentesData(result);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const changeDate = (delta: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const newDate = new Date(y, m - 1, d + delta);
    setDate(format(newDate, "yyyy-MM-dd"));
  };

  const consolidatedTotals = gerentesData.reduce(
    (acc, g) => ({
      meta_ligacoes: acc.meta_ligacoes + g.totals.meta_ligacoes,
      real_ligacoes: acc.real_ligacoes + g.totals.real_ligacoes,
      meta_leads: acc.meta_leads + g.totals.meta_leads,
      real_leads: acc.real_leads + g.totals.real_leads,
      meta_visitas_marcadas: acc.meta_visitas_marcadas + g.totals.meta_visitas_marcadas,
      real_visitas_marcadas: acc.real_visitas_marcadas + g.totals.real_visitas_marcadas,
      real_visitas_realizadas: acc.real_visitas_realizadas + g.totals.real_visitas_realizadas,
      real_propostas: acc.real_propostas + g.totals.real_propostas,
      presentes: acc.presentes + g.totals.presentes,
      ausentes: acc.ausentes + g.totals.ausentes,
      total: acc.total + g.totals.total,
    }),
    { meta_ligacoes: 0, real_ligacoes: 0, meta_leads: 0, real_leads: 0, meta_visitas_marcadas: 0, real_visitas_marcadas: 0, real_visitas_realizadas: 0, real_propostas: 0, presentes: 0, ausentes: 0, total: 0 }
  );

  const pctVal = (real: number, meta: number) => meta > 0 ? Math.round((real / meta) * 100) : 0;
  const pctColor = (p: number) => p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive";

  const cpStatusLabel = (s: string) => {
    if (s === "aberto") return { label: "🔵 Aberto", cls: "bg-info/10 text-info border-info/30" };
    if (s === "metas_publicadas") return { label: "🟡 Metas publicadas", cls: "bg-warning/10 text-warning border-warning/30" };
    if (s === "fechado") return { label: "🟢 Fechado", cls: "bg-success/10 text-success border-success/30" };
    return { label: "⚪ Não criado", cls: "bg-muted/10 text-muted-foreground border-border" };
  };

  // Alerts
  const diaUtil = isDiaUtil(date);
  const alerts: { type: "warning" | "info"; text: string }[] = [];

  if (!diaUtil) {
    alerts.push({ type: "info", text: "Dia não útil — checkpoint não obrigatório" });
  } else {
    for (const g of gerentesData) {
      if (g.checkpoint_status === "não_criado") {
        alerts.push({ type: "warning", text: `${g.gerente_nome} não criou checkpoint hoje` });
      }
    }
  }

  for (const g of gerentesData) {
    const txVisita = g.totals.real_visitas_marcadas > 0 ? Math.round((g.totals.real_visitas_realizadas / g.totals.real_visitas_marcadas) * 100) : -1;
    if (txVisita >= 0 && txVisita < 40) {
      alerts.push({ type: "warning", text: `${g.gerente_nome}: baixa taxa de visita (${txVisita}%)` });
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando checkpoints...</div>;

  return (
    <div className="space-y-4">
      {/* Header with date nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Checkpoints dos Gerentes</h2>
          <Badge variant="outline" className="text-[10px]">Somente leitura</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => changeDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Calendar className="h-4 w-4 text-primary" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm font-medium text-foreground border-none outline-none" />
          </div>
          <Button size="sm" variant="outline" onClick={() => changeDate(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground capitalize">{dateLabel}</p>

      {/* Checkpoint Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const isInfo = a.type === "info";
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  isInfo
                    ? "border-border bg-muted/50 text-muted-foreground"
                    : "border-warning/20 bg-warning/5 text-warning"
                }`}
              >
                {isInfo ? <CalendarOff className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                {a.text}
              </div>
            );
          })}
        </div>
      )}

      {gerentesData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum gerente encontrado.</div>
      ) : (
        <>
          {/* Consolidated summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Corretores", value: consolidatedTotals.total, sub: `${consolidatedTotals.presentes} presentes` },
              { label: "Ligações", value: consolidatedTotals.real_ligacoes, meta: consolidatedTotals.meta_ligacoes },
              { label: "Aproveitados", value: consolidatedTotals.real_leads, meta: consolidatedTotals.meta_leads },
              { label: "V. Marcadas", value: consolidatedTotals.real_visitas_marcadas, meta: consolidatedTotals.meta_visitas_marcadas },
              { label: "V. Realizadas", value: consolidatedTotals.real_visitas_realizadas },
              { label: "Propostas", value: consolidatedTotals.real_propostas },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">{c.label}</p>
                <p className="text-xl font-display font-bold text-foreground mt-1">{c.value}</p>
                {c.meta != null && (
                  <p className={`text-[10px] font-semibold mt-0.5 ${pctColor(pctVal(c.value, c.meta))}`}>
                    {pctVal(c.value, c.meta)}% da meta ({c.meta})
                  </p>
                )}
                {c.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Comparativo lado a lado */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display font-semibold text-sm">Comparativo entre Gerentes</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2 font-display font-semibold">Gerente</th>
                  <th className="px-2 py-2 text-center">Status</th>
                  <th className="px-2 py-2 text-center">Corretores</th>
                  <th className="px-2 py-2 text-center">Ligações</th>
                  <th className="px-2 py-2 text-center">Aproveit.</th>
                  <th className="px-2 py-2 text-center">V.Marc</th>
                  <th className="px-2 py-2 text-center">V.Real</th>
                  <th className="px-2 py-2 text-center">Propostas</th>
                  <th className="px-2 py-2 text-center">% Lig.</th>
                  <th className="px-2 py-2 text-center text-primary">Tx Visita</th>
                  <th className="px-2 py-2 text-center text-primary">Tx Proposta</th>
                  <th className="px-2 py-2 text-center text-primary">Eficiência</th>
                </tr>
              </thead>
              <tbody>
                {gerentesData.map(g => {
                  const st = cpStatusLabel(g.checkpoint_status);
                  const ligPct = pctVal(g.totals.real_ligacoes, g.totals.meta_ligacoes);
                  const txVisita = g.totals.real_visitas_marcadas > 0 ? Math.round((g.totals.real_visitas_realizadas / g.totals.real_visitas_marcadas) * 100) : 0;
                  const txProposta = g.totals.real_visitas_realizadas > 0 ? Math.round((g.totals.real_propostas / g.totals.real_visitas_realizadas) * 100) : 0;
                  const eficiencia = g.totals.real_ligacoes > 0 ? ((g.totals.real_propostas / g.totals.real_ligacoes) * 100).toFixed(1) : "0";
                  return (
                    <tr key={g.gerente_id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{g.gerente_nome}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-2 py-2 text-center">{g.totals.presentes}/{g.totals.total}</td>
                      <td className="px-2 py-2 text-center">
                        <span className="font-bold text-foreground">{g.totals.real_ligacoes}</span>
                        <span className="text-muted-foreground text-[10px] block">de {g.totals.meta_ligacoes}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="font-bold text-foreground">{g.totals.real_leads}</span>
                        <span className="text-muted-foreground text-[10px] block">de {g.totals.meta_leads}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="font-bold text-foreground">{g.totals.real_visitas_marcadas}</span>
                        <span className="text-muted-foreground text-[10px] block">de {g.totals.meta_visitas_marcadas}</span>
                      </td>
                      <td className="px-2 py-2 text-center font-bold">{g.totals.real_visitas_realizadas}</td>
                      <td className="px-2 py-2 text-center font-bold">{g.totals.real_propostas}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-semibold ${pctColor(ligPct)}`}>{ligPct}%</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-semibold ${txVisita >= 70 ? "text-success" : txVisita >= 40 ? "text-warning" : "text-destructive"}`}>{txVisita}%</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`font-semibold ${txProposta >= 30 ? "text-success" : txProposta >= 15 ? "text-warning" : "text-destructive"}`}>{txProposta}%</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="font-semibold text-muted-foreground">{eficiencia}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Drilldown per gerente */}
          <Tabs value={activeGerente} onValueChange={setActiveGerente} className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="consolidado" className="gap-1.5 text-xs py-2">
                <TrendingUp className="h-3.5 w-3.5" /> Visão Consolidada
              </TabsTrigger>
              {gerentesData.map(g => (
                <TabsTrigger key={g.gerente_id} value={g.gerente_id} className="gap-1.5 text-xs py-2">
                  <Users className="h-3.5 w-3.5" /> {g.gerente_nome}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="consolidado" className="mt-4">
              <div className="space-y-4">
                {gerentesData.map(g => {
                  const st = cpStatusLabel(g.checkpoint_status);
                  return (
                    <div key={g.gerente_id} className="rounded-xl border border-border bg-card shadow-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-primary" />
                          <h4 className="font-display font-semibold text-sm">{g.gerente_nome}</h4>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${st.cls}`}>{st.label}</span>
                        </div>
                        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setActiveGerente(g.gerente_id)}>
                          <Eye className="h-3 w-3" /> Ver equipe
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[
                          { label: "Corretores", value: `${g.totals.presentes}/${g.totals.total}` },
                          { label: "Ligações", value: `${g.totals.real_ligacoes}/${g.totals.meta_ligacoes}`, pct: pctVal(g.totals.real_ligacoes, g.totals.meta_ligacoes) },
                          { label: "Aproveit.", value: `${g.totals.real_leads}/${g.totals.meta_leads}`, pct: pctVal(g.totals.real_leads, g.totals.meta_leads) },
                          { label: "V. Marcadas", value: `${g.totals.real_visitas_marcadas}/${g.totals.meta_visitas_marcadas}`, pct: pctVal(g.totals.real_visitas_marcadas, g.totals.meta_visitas_marcadas) },
                          { label: "V. Realizadas", value: String(g.totals.real_visitas_realizadas) },
                          { label: "Propostas", value: String(g.totals.real_propostas) },
                        ].map(c => (
                          <div key={c.label} className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
                            <p className="text-sm font-bold text-foreground">{c.value}</p>
                            {c.pct != null && <p className={`text-[10px] font-semibold ${pctColor(c.pct)}`}>{c.pct}%</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {gerentesData.map(g => (
              <TabsContent key={g.gerente_id} value={g.gerente_id} className="mt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display font-semibold text-sm">Checkpoint de {g.gerente_nome}</h3>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${cpStatusLabel(g.checkpoint_status).cls}`}>
                      {cpStatusLabel(g.checkpoint_status).label}
                    </span>
                  </div>

                  {g.lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum corretor no time.</p>
                  ) : (
                    <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-3 py-2 font-display font-semibold min-w-[140px]">Corretor</th>
                            <th colSpan={3} className="text-center px-2 py-1 font-display font-semibold text-primary border-l border-border">METAS</th>
                            <th colSpan={5} className="text-center px-2 py-1 font-display font-semibold text-success border-l border-border">RESULTADOS</th>
                            <th className="text-center px-2 py-1 font-display font-semibold border-l border-border">ST</th>
                          </tr>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="px-3 py-1.5 text-left"></th>
                            <th className="px-2 py-1.5 text-center border-l border-border">Lig.</th>
                            <th className="px-2 py-1.5 text-center">Aprov.</th>
                            <th className="px-2 py-1.5 text-center">V.Marc</th>
                            <th className="px-2 py-1.5 text-center border-l border-border">Lig.</th>
                            <th className="px-2 py-1.5 text-center">Aprov.</th>
                            <th className="px-2 py-1.5 text-center">V.Marc</th>
                            <th className="px-2 py-1.5 text-center">V.Real</th>
                            <th className="px-2 py-1.5 text-center">Prop.</th>
                            <th className="px-2 py-1.5 text-center border-l border-border">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.lines.map(line => {
                            const isFalta = line.meta_presenca === "falta";
                            return (
                              <tr key={line.auth_user_id} className={`border-b border-border hover:bg-muted/10 ${isFalta ? "opacity-50 bg-destructive/5" : ""}`}>
                                <td className="px-3 py-1.5 font-medium">
                                  {line.corretor_nome}
                                  {isFalta && <span className="ml-1 text-[9px] text-destructive">(falta)</span>}
                                </td>
                                <td className="px-2 py-1.5 text-center border-l border-border">{line.meta_ligacoes}</td>
                                <td className="px-2 py-1.5 text-center">{line.meta_leads}</td>
                                <td className="px-2 py-1.5 text-center">{line.meta_visitas_marcadas}</td>
                                <td className="px-2 py-1.5 text-center border-l border-border">{line.real_ligacoes ?? "—"}</td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className={`font-bold ${(line.real_leads ?? 0) > 0 ? "text-success" : "text-muted-foreground"}`}>
                                    {line.real_leads ?? "—"}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-center">{line.real_visitas_marcadas ?? "—"}</td>
                                <td className="px-2 py-1.5 text-center">{line.real_visitas_realizadas ?? "—"}</td>
                                <td className="px-2 py-1.5 text-center">{line.real_propostas ?? "—"}</td>
                                <td className="px-2 py-1.5 text-center border-l border-border">
                                  {isFalta ? (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold border bg-destructive/10 text-destructive border-destructive/30">Falta</span>
                                  ) : line.status_dia ? (
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColors[line.status_dia] || ""}`}>
                                      {line.status_dia}
                                    </span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-muted/30 font-semibold">
                            <td className="px-3 py-2">Total</td>
                            <td className="px-2 py-2 text-center border-l border-border">{g.totals.meta_ligacoes}</td>
                            <td className="px-2 py-2 text-center">{g.totals.meta_leads}</td>
                            <td className="px-2 py-2 text-center">{g.totals.meta_visitas_marcadas}</td>
                            <td className="px-2 py-2 text-center border-l border-border">{g.totals.real_ligacoes}</td>
                            <td className="px-2 py-2 text-center">{g.totals.real_leads}</td>
                            <td className="px-2 py-2 text-center">{g.totals.real_visitas_marcadas}</td>
                            <td className="px-2 py-2 text-center">{g.totals.real_visitas_realizadas}</td>
                            <td className="px-2 py-2 text-center">{g.totals.real_propostas}</td>
                            <td className="px-2 py-2 text-center border-l border-border"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
