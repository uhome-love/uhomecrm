import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Users, TrendingUp, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GerenteCheckpoint {
  gerente_id: string;
  gerente_nome: string;
  checkpoint_id: string | null;
  checkpoint_status: string;
  lines: {
    corretor_id: string;
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

    const { data: gestorRoles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
    const gestorIds = (gestorRoles || []).map(r => r.user_id);
    if (gestorIds.length === 0) { setGerentesData([]); setLoading(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", gestorIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));

    const { data: cps } = await supabase.from("checkpoints").select("*").eq("data", date).in("gerente_id", gestorIds);
    const cpMap = new Map((cps || []).map(c => [c.gerente_id, c]));

    const { data: allTeam } = await supabase.from("team_members").select("id, nome, gerente_id, status, user_id").in("gerente_id", gestorIds).eq("status", "ativo").order("nome");
    const teamByGerente = new Map<string, typeof allTeam>();
    for (const t of (allTeam || [])) {
      const arr = teamByGerente.get(t.gerente_id) || [];
      arr.push(t);
      teamByGerente.set(t.gerente_id, arr);
    }

    // Fetch OA stats for all linked team members
    const linkedMembers = (allTeam || []).filter(m => m.user_id);
    const userIds = linkedMembers.map(m => m.user_id!);
    const oaStatsById: Record<string, { ligacoes: number; leads: number }> = {};
    const visitasStatsById: Record<string, { marcadas: number; realizadas: number }> = {};
    if (userIds.length > 0) {
      const dayStart = `${date}T00:00:00-03:00`;
      const dayEnd = `${date}T23:59:59.999-03:00`;
      // Fetch OA tentativas and visitas in parallel batches
      // V.Marc = visitas created on this date; V.Real = visitas realized on this date
      const visitasCriadasPromise = supabase
        .from("visitas")
        .select("corretor_id, status")
        .in("corretor_id", userIds)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);
      const visitasRealizadasPromise = supabase
        .from("visitas")
        .select("corretor_id, status")
        .in("corretor_id", userIds)
        .eq("data_visita", date)
        .eq("status", "realizada");

      for (let i = 0; i < userIds.length; i += 50) {
        const batch = userIds.slice(i, i + 50);
        const { data: tentativas } = await supabase
          .from("oferta_ativa_tentativas")
          .select("corretor_id, resultado")
          .in("corretor_id", batch)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd);
        for (const t of (tentativas || [])) {
          if (!oaStatsById[t.corretor_id]) oaStatsById[t.corretor_id] = { ligacoes: 0, leads: 0 };
          oaStatsById[t.corretor_id].ligacoes++;
          if (t.resultado === "com_interesse") oaStatsById[t.corretor_id].leads++;
        }
      }

      const [{ data: visitasCriadas }, { data: visitasRealizadas }] = await Promise.all([
        visitasCriadasPromise,
        visitasRealizadasPromise,
      ]);
      for (const v of (visitasCriadas || [])) {
        if (!visitasStatsById[v.corretor_id]) visitasStatsById[v.corretor_id] = { marcadas: 0, realizadas: 0 };
        if (v.status !== "cancelada") visitasStatsById[v.corretor_id].marcadas++;
      }
      for (const v of (visitasRealizadas || [])) {
        if (!visitasStatsById[v.corretor_id]) visitasStatsById[v.corretor_id] = { marcadas: 0, realizadas: 0 };
        visitasStatsById[v.corretor_id].realizadas++;
      }
    }
    // Map user_id -> team_member.id for OA stats and visitas stats
    const oaStatsByMemberId: Record<string, { ligacoes: number; leads: number }> = {};
    const visitasStatsByMemberId: Record<string, { marcadas: number; realizadas: number }> = {};
    for (const m of linkedMembers) {
      if (m.user_id && oaStatsById[m.user_id]) {
        oaStatsByMemberId[m.id] = oaStatsById[m.user_id];
      }
      if (m.user_id && visitasStatsById[m.user_id]) {
        visitasStatsByMemberId[m.id] = visitasStatsById[m.user_id];
      }
    }

    // Fetch corretor daily goals for metas
    const goalsMap: Record<string, { meta_ligacoes: number; meta_aproveitados: number; meta_visitas_marcadas: number }> = {};
    if (userIds.length > 0) {
      const { data: goals } = await supabase
        .from("corretor_daily_goals")
        .select("corretor_id, meta_ligacoes, meta_aproveitados, meta_visitas_marcadas")
        .in("corretor_id", userIds)
        .eq("data", date);
      for (const g of (goals || []) as any[]) {
        const member = linkedMembers.find(m => m.user_id === g.corretor_id);
        if (member) {
          goalsMap[member.id] = { meta_ligacoes: g.meta_ligacoes, meta_aproveitados: g.meta_aproveitados, meta_visitas_marcadas: g.meta_visitas_marcadas ?? 0 };
        }
      }
      // Fallback to most recent goals for corretores without today's goals
      const foundIds = new Set((goals || []).map((g: any) => g.corretor_id));
      const missingIds = userIds.filter(id => !foundIds.has(id));
      if (missingIds.length > 0) {
        const { data: recentGoals } = await supabase
          .from("corretor_daily_goals")
          .select("corretor_id, meta_ligacoes, meta_aproveitados, meta_visitas_marcadas, data")
          .in("corretor_id", missingIds)
          .lte("data", date)
          .order("data", { ascending: false });
        const seenRecent = new Set<string>();
        for (const g of (recentGoals || []) as any[]) {
          if (seenRecent.has(g.corretor_id)) continue;
          seenRecent.add(g.corretor_id);
          const member = linkedMembers.find(m => m.user_id === g.corretor_id);
          if (member) {
            goalsMap[member.id] = { meta_ligacoes: g.meta_ligacoes, meta_aproveitados: g.meta_aproveitados, meta_visitas_marcadas: g.meta_visitas_marcadas ?? 0 };
          }
        }
      }
    }

    const cpIds = (cps || []).map(c => c.id);
    const { data: allLines } = cpIds.length > 0
      ? await supabase.from("checkpoint_lines").select("*").in("checkpoint_id", cpIds)
      : { data: [] };
    const linesByCp = new Map<string, typeof allLines>();
    for (const l of (allLines || [])) {
      const arr = linesByCp.get(l.checkpoint_id) || [];
      arr.push(l);
      linesByCp.set(l.checkpoint_id, arr);
    }

    const result: GerenteCheckpoint[] = [];
    for (const gId of gestorIds) {
      const cp = cpMap.get(gId);
      const team = teamByGerente.get(gId) || [];
      const cpLines = cp ? (linesByCp.get(cp.id) || []) : [];
      const linesMap = new Map(cpLines.map(l => [l.corretor_id, l]));

      const lines = team.map(t => {
        const l = linesMap.get(t.id);
        const oa = oaStatsByMemberId[t.id];
        const vis = visitasStatsByMemberId[t.id];
        const cGoal = goalsMap[t.id];
        return {
          corretor_id: t.id,
          corretor_nome: t.nome,
          meta_ligacoes: cGoal ? cGoal.meta_ligacoes : (l?.meta_ligacoes ?? 0),
          meta_leads: cGoal ? cGoal.meta_aproveitados : (l?.meta_leads ?? 0),
          meta_visitas_marcadas: cGoal ? cGoal.meta_visitas_marcadas : (l?.meta_visitas_marcadas ?? 0),
          meta_presenca: l?.meta_presenca ?? "sim",
          obs_gerente: l?.obs_gerente ?? "",
          real_ligacoes: l?.real_ligacoes != null ? l.real_ligacoes : (oa?.ligacoes ?? null),
          real_leads: l?.real_leads != null ? l.real_leads : (oa?.leads ?? null),
          real_visitas_marcadas: vis ? vis.marcadas : (l?.real_visitas_marcadas ?? null),
          real_visitas_realizadas: vis ? vis.realizadas : (l?.real_visitas_realizadas ?? null),
          real_propostas: l?.real_propostas ?? null,
          obs_dia: l?.obs_dia ?? null,
          status_dia: l?.status_dia ?? null,
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

      result.push({
        gerente_id: gId,
        gerente_nome: profileMap.get(gId) || "Gerente",
        checkpoint_id: cp?.id || null,
        checkpoint_status: cp?.status || "não_criado",
        lines,
        totals,
      });
    }

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
  const alerts = gerentesData.filter(g => g.checkpoint_status === "não_criado").map(g => ({
    type: "warning" as const,
    text: `${g.gerente_nome} não criou checkpoint hoje`,
  }));

  // Low conversion alerts
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
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-warning/20 bg-warning/5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {a.text}
            </div>
          ))}
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

          {/* Comparativo lado a lado - Enhanced with conversion rates */}
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
                              <tr key={line.corretor_id} className={`border-b border-border hover:bg-muted/10 ${isFalta ? "opacity-50 bg-destructive/5" : ""}`}>
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
