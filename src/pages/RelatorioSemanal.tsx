import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronLeft, ChevronRight, Download, Loader2, Users, Phone, Inbox, Activity,
  CalendarDays, CalendarCheck, Briefcase, TrendingUp, FileSignature, DollarSign,
  ArrowUp, ArrowDown, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { format, getISOWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBRLCompact } from "@/lib/utils";
import {
  useRelatorioExecutivo,
  useUserScope,
  getPeriodRange,
  type PeriodMode,
  type ExecutiveKpis,
  type CorretorRow,
  type TeamRow,
} from "@/hooks/useRelatorioExecutivo";
import ExecutiveKpiDetailDialog, { type ExecKpiType } from "@/components/relatorio/ExecutiveKpiDetailDialog";

// ── KPI Card Config ──
const KPI_CONFIG: { key: keyof ExecutiveKpis; label: string; icon: any; color: string; isCurrency?: boolean }[] = [
  { key: "presencas", label: "Presenças", icon: Users, color: "text-blue-600" },
  { key: "ligacoes", label: "Ligações", icon: Phone, color: "text-indigo-600" },
  { key: "leadsRecebidos", label: "Leads Recebidos", icon: Inbox, color: "text-cyan-600" },
  { key: "leadsAtivos", label: "Leads Ativos", icon: Activity, color: "text-teal-600" },
  { key: "visitasMarcadas", label: "Visitas Marcadas", icon: CalendarDays, color: "text-amber-600" },
  { key: "visitasRealizadas", label: "Visitas Realizadas", icon: CalendarCheck, color: "text-emerald-600" },
  { key: "negociosCriados", label: "Negócios Criados", icon: Briefcase, color: "text-violet-600" },
  { key: "negociosGerados", label: "Negócios Gerados", icon: TrendingUp, color: "text-orange-600" },
  { key: "negociosAssinados", label: "Negócios Assinados", icon: FileSignature, color: "text-emerald-700" },
  { key: "vgvTotal", label: "VGV Total", icon: DollarSign, color: "text-emerald-700", isCurrency: true },
];

// ── Variation Badge ──
function VarBadge({ pctChange, periodLabel }: { pctChange: number; periodLabel: string }) {
  if (pctChange === 0) return null;
  const up = pctChange > 0;
  return (
    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-destructive"}`}>
      {up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(pctChange)}% {periodLabel}
    </span>
  );
}

// ── Sort helpers ──
type SortKey = keyof CorretorRow;

// ── Main Page ──
export default function RelatorioSemanal() {
  const { scope } = useUserScope();
  const [mode, setMode] = useState<PeriodMode>("semana");
  const [offset, setOffset] = useState(0);
  const period = useMemo(() => getPeriodRange(mode, offset), [mode, offset]);
  const { data, isLoading } = useRelatorioExecutivo(period);
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const isMobile = useIsMobile();

  // KPI detail dialog state
  const [kpiDetail, setKpiDetail] = useState<{ type: ExecKpiType; label: string } | null>(null);
  const kpiDateRange = useMemo(() => ({
    start: format(period.start, "yyyy-MM-dd"),
    end: format(period.end, "yyyy-MM-dd"),
  }), [period.start, period.end]);

  // Team/corretor filter
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedCorretor, setSelectedCorretor] = useState<string>("all");

  // Ranking sort state
  const [sortKey, setSortKey] = useState<SortKey>("vgv");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleTeam = (eq: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      next.has(eq) ? next.delete(eq) : next.add(eq);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Filter corretores by selected team or corretor
  const filteredCorretores = useMemo(() => {
    if (!data?.corretores) return [];
    let list = data.corretores;
    if (selectedTeam !== "all") list = list.filter(c => c.equipe === selectedTeam);
    if (selectedCorretor !== "all") list = list.filter(c => c.id === selectedCorretor);
    return list;
  }, [data?.corretores, selectedTeam, selectedCorretor]);

  const sortedCorretores = useMemo(() => {
    return [...filteredCorretores].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      if (typeof va === "string") return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filteredCorretores, sortKey, sortAsc]);

  // Filtered KPIs: recalculate from corretores when a team is selected
  const filteredKpis = useMemo(() => {
    if (!data?.kpis) return data?.kpis;
    if (selectedTeam === "all") return data.kpis;
    // Sum from filtered corretores
    const cs = filteredCorretores;
    const sumPresencas = cs.reduce((s, c) => s + c.presencas, 0);
    const sumLigacoes = cs.reduce((s, c) => s + c.ligacoes, 0);
    const sumLeads = cs.reduce((s, c) => s + c.leads, 0);
    const sumVisMarcadas = cs.reduce((s, c) => s + c.visitasMarcadas, 0);
    const sumVisRealizadas = cs.reduce((s, c) => s + c.visitasRealizadas, 0);
    const sumNegCriados = cs.reduce((s, c) => s + c.negociosCriados, 0);
    const sumNegAssinados = cs.reduce((s, c) => s + c.negociosAssinados, 0);
    const sumVgv = cs.reduce((s, c) => s + c.vgv, 0);
    const mk = (cur: number) => ({ current: cur, prev: 0, pctChange: 0 });
    return {
      ...data.kpis,
      presencas: mk(sumPresencas),
      ligacoes: mk(sumLigacoes),
      leadsRecebidos: mk(sumLeads),
      visitasMarcadas: mk(sumVisMarcadas),
      visitasRealizadas: mk(sumVisRealizadas),
      negociosCriados: mk(sumNegCriados),
      negociosAssinados: mk(sumNegAssinados),
      vgvTotal: { ...mk(sumVgv), currentRaw: sumVgv, prevRaw: 0 },
    } as typeof data.kpis;
  }, [data?.kpis, selectedTeam, filteredCorretores]);

  // Find top performer for each column
  const topPerformers = useMemo(() => {
    if (!filteredCorretores.length) return {};
    const keys: SortKey[] = ["presencas", "ligacoes", "leads", "visitasMarcadas", "visitasRealizadas", "negociosCriados", "negociosAssinados", "vgv"];
    const result: Record<string, string> = {};
    keys.forEach(k => {
      const top = [...filteredCorretores].sort((a, b) => (b[k] as number) - (a[k] as number))[0];
      if (top && (top[k] as number) > 0) result[k] = top.id;
    });
    return result;
  }, [filteredCorretores]);

  const prevPeriodLabel = mode === "semana" ? "vs semana ant." : "vs mês ant.";

  const handlePDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const mod = await import("html2pdf.js");
      const html2pdfFn = (mod.default || mod) as any;
      await html2pdfFn().set({
        margin: [8, 8, 8, 8],
        filename: `relatorio-executivo-${format(period.start, "yyyy-MM-dd")}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      }).from(reportRef.current.cloneNode(true)).save();
    } catch (e) {
      console.error("PDF error:", e);
      toast.error("Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  };

  const scopeLabel = scope === "admin" 
    ? (selectedTeam === "all" ? "Empresa" : selectedTeam)
    : scope === "gerente" ? "Minha Equipe" : "Meus Números";
  const teamOptions = useMemo(() => data?.teams?.map(t => t.equipe) || [], [data?.teams]);

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            📊 Relatório Geral
          </h1>
          <p className="text-sm text-muted-foreground">{scopeLabel} · Visão consolidada</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePDF} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            PDF
          </Button>
        </div>
      </div>

      {/* ── Period Toggle + Navigation ── */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => { setMode("semana"); setOffset(0); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "semana" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Semanal
          </button>
          <button
            onClick={() => { setMode("mes"); setOffset(0); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "mes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Mensal
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-sm px-4 py-1.5 font-medium min-w-[200px] text-center justify-center">
            {period.label}
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Filters: Team (CEO) + Corretor (Gerente/CEO) */}
        {scope !== "corretor" && (data?.corretores?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 justify-center flex-wrap">
            {scope === "admin" && teamOptions.length > 0 && (
              <Select value={selectedTeam} onValueChange={(v) => { setSelectedTeam(v); setSelectedCorretor("all"); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {teamOptions.map(eq => (
                    <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedCorretor} onValueChange={setSelectedCorretor}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos os corretores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os corretores</SelectItem>
                {(selectedTeam === "all" ? data?.corretores || [] : (data?.corretores || []).filter(c => c.equipe === selectedTeam))
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div ref={reportRef} className="space-y-6">
        {/* ═══ BLOCO 1 — KPI Cards ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {KPI_CONFIG.map(({ key, label, icon: Icon, color, isCurrency }) => {
            const val = filteredKpis?.[key];
            return (
              <div key={key} onClick={() => !isLoading && key !== "leadsAtivos" && setKpiDetail({ type: key, label })} className={`bg-background border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${key !== "leadsAtivos" ? "cursor-pointer" : ""}`}>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="text-[11px] text-muted-foreground font-medium truncate">{label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {isCurrency ? formatBRLCompact(val?.current ?? 0) : (val?.current ?? 0).toLocaleString("pt-BR")}
                    </p>
                    {key !== "leadsAtivos" && val && (
                      <VarBadge pctChange={val.pctChange} periodLabel={prevPeriodLabel} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ BLOCO 2 — Gráficos de Tendência ═══ */}
        {!isLoading && data?.dailyTrends && data.dailyTrends.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Line chart — daily KPIs */}
            <div className="bg-background border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-4">Evolução Diária</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="diaLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RTooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="ligacoes" name="Ligações" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="leads" name="Leads" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="visitas" name="Visitas" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart — comparison */}
            <div className="bg-background border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-4">Leads × Visitas × Negócios</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="diaLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RTooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="leads" name="Leads" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="visitas" name="Visitas" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="negocios" name="Negócios" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ BLOCO 2.5 — Visão por Equipe (tabela comparativa) ═══ */}
        {!isLoading && data?.teams && data.teams.length > 0 && scope !== "corretor" && (
          <div className="bg-background border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">👥 Visão por Equipe</h3>
              <p className="text-[10px] text-muted-foreground">Comparativo consolidado entre equipes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Equipe</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Corretores</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Presenças</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Ligações</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Leads</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Vis.Marc.</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Vis.Real.</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Neg.Cri.</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Assinados</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">VGV</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((team, i) => (
                    <tr key={team.equipe} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/5" : ""}`}>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${team.color}`}>{team.equipe}</span>
                      </td>
                      <td className="text-center px-2 py-2.5 font-medium">{team.corretores.length}</td>
                      <td className="text-center px-2 py-2.5 font-semibold">{team.totals.presencas}</td>
                      <td className="text-center px-2 py-2.5 font-semibold">{team.totals.ligacoes}</td>
                      <td className="text-center px-2 py-2.5 font-semibold">{team.totals.leads}</td>
                      <td className="text-center px-2 py-2.5 font-semibold">{team.totals.visitasMarcadas}</td>
                      <td className="text-center px-2 py-2.5 font-semibold">{team.totals.visitasRealizadas}</td>
                      <td className="text-center px-2 py-2.5 font-semibold">{team.totals.negociosCriados}</td>
                      <td className="text-center px-2 py-2.5 font-semibold">{team.totals.negociosAssinados}</td>
                      <td className="text-right px-3 py-2.5 font-bold text-emerald-600">{formatBRLCompact(team.totals.vgv)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 border-border bg-muted/30 font-bold">
                    <td className="px-3 py-2.5 text-foreground">Total</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.corretores.length, 0)}</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.totals.presencas, 0)}</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.totals.ligacoes, 0)}</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.totals.leads, 0)}</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.totals.visitasMarcadas, 0)}</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.totals.visitasRealizadas, 0)}</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.totals.negociosCriados, 0)}</td>
                    <td className="text-center px-2 py-2.5">{data.teams.reduce((s, t) => s + t.totals.negociosAssinados, 0)}</td>
                    <td className="text-right px-3 py-2.5 text-emerald-600">{formatBRLCompact(data.teams.reduce((s, t) => s + t.totals.vgv, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ BLOCO 3 — Ranking de Corretores ═══ */}
        {!isLoading && sortedCorretores.length > 0 && (
          <div className="bg-background border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">🏆 Ranking de Corretores</h3>
              <p className="text-[10px] text-muted-foreground">Clique no cabeçalho para ordenar · ⭐ = top da coluna</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {([
                      { key: "nome" as SortKey, label: "Corretor", align: "left" },
                      { key: "equipe" as SortKey, label: "Equipe", align: "left" },
                      { key: "presencas" as SortKey, label: "Pres.", align: "center" },
                      { key: "ligacoes" as SortKey, label: "Ligações", align: "center" },
                      { key: "leads" as SortKey, label: "Leads", align: "center" },
                      { key: "visitasMarcadas" as SortKey, label: "Vis.Marc.", align: "center" },
                      { key: "visitasRealizadas" as SortKey, label: "Vis.Real.", align: "center" },
                      { key: "negociosCriados" as SortKey, label: "Neg.Cri.", align: "center" },
                      { key: "negociosAssinados" as SortKey, label: "Assinados", align: "center" },
                      { key: "vgv" as SortKey, label: "VGV", align: "right" },
                    ]).map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`px-3 py-2.5 font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCorretores.map((c, i) => (
                    <tr key={c.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                      <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                        <span className="text-muted-foreground text-[10px] mr-1.5">#{i + 1}</span>
                        {c.nome}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${c.equipeColor}`}>{c.equipe}</span>
                      </td>
                      {(["presencas", "ligacoes", "leads", "visitasMarcadas", "visitasRealizadas", "negociosCriados", "negociosAssinados"] as SortKey[]).map(k => (
                        <td key={k} className="px-3 py-2.5 text-center">
                          <span className={`font-semibold ${topPerformers[k] === c.id ? "text-amber-600" : "text-foreground"}`}>
                            {topPerformers[k] === c.id && "⭐ "}{(c[k] as number) || 0}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-bold ${topPerformers.vgv === c.id ? "text-amber-600" : c.vgv > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {topPerformers.vgv === c.id && "⭐ "}{c.vgv > 0 ? formatBRLCompact(c.vgv) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ BLOCO 4 — Breakdown por Equipe ═══ */}
        {!isLoading && data?.teams && data.teams.length > 0 && scope !== "corretor" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground px-1">📋 Breakdown por Equipe</h3>
            {data.teams.map(team => (
              <Collapsible key={team.equipe} open={expandedTeams.has(team.equipe)} onOpenChange={() => toggleTeam(team.equipe)}>
                <div className="bg-background border border-border rounded-xl shadow-sm overflow-hidden">
                  <CollapsibleTrigger className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${team.color}`}>{team.equipe}</span>
                      <span className="text-xs text-muted-foreground">{team.corretores.length} corretor(es)</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">Lig: <strong className="text-foreground">{team.totals.ligacoes}</strong></span>
                        <span className="text-muted-foreground">Vis: <strong className="text-foreground">{team.totals.visitasRealizadas}</strong></span>
                        <span className="text-muted-foreground">Neg: <strong className="text-foreground">{team.totals.negociosAssinados}</strong></span>
                        <span className="text-muted-foreground">VGV: <strong className="text-emerald-600">{formatBRLCompact(team.totals.vgv)}</strong></span>
                      </div>
                      {expandedTeams.has(team.equipe) ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-border">
                      {/* Team totals */}
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 px-5 py-3 bg-muted/20">
                        {[
                          { label: "Presenças", value: team.totals.presencas },
                          { label: "Ligações", value: team.totals.ligacoes },
                          { label: "Leads", value: team.totals.leads },
                          { label: "Vis.Marc.", value: team.totals.visitasMarcadas },
                          { label: "Vis.Real.", value: team.totals.visitasRealizadas },
                          { label: "Neg.Cri.", value: team.totals.negociosCriados },
                          { label: "Assinados", value: team.totals.negociosAssinados },
                          { label: "VGV", value: team.totals.vgv, isCurrency: true },
                        ].map(item => (
                          <div key={item.label} className="text-center">
                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                            <p className="text-sm font-bold text-foreground">
                              {item.isCurrency ? formatBRLCompact(item.value) : item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Per-corretor mini table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/10">
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Corretor</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Pres.</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Lig.</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Leads</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground">V.M.</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground">V.R.</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Neg.</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Ass.</th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">VGV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.corretores.sort((a, b) => b.vgv - a.vgv).map((c, i) => {
                              // Progress bar relative to team max
                              const teamMax = Math.max(...team.corretores.map(x => x.ligacoes), 1);
                              const barPct = Math.round((c.ligacoes / teamMax) * 100);

                              return (
                                <tr key={c.id} className={`border-b border-border/30 hover:bg-muted/10 ${i % 2 !== 0 ? "bg-muted/5" : ""}`}>
                                  <td className="px-3 py-2 font-medium text-foreground">{c.nome}</td>
                                  <td className="text-center px-2 py-2">{c.presencas}</td>
                                  <td className="text-center px-2 py-2">
                                    <div className="flex items-center gap-1 justify-center">
                                      <span className="font-semibold">{c.ligacoes}</span>
                                      <div className="hidden md:block w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${barPct}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-center px-2 py-2">{c.leads}</td>
                                  <td className="text-center px-2 py-2">{c.visitasMarcadas}</td>
                                  <td className="text-center px-2 py-2">{c.visitasRealizadas}</td>
                                  <td className="text-center px-2 py-2">{c.negociosCriados}</td>
                                  <td className="text-center px-2 py-2">{c.negociosAssinados}</td>
                                  <td className="text-right px-3 py-2 font-semibold">{c.vgv > 0 ? formatBRLCompact(c.vgv) : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!data?.corretores || data.corretores.length === 0) && (
          <div className="bg-background border border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground">Sem dados disponíveis para o período selecionado.</p>
          </div>
        )}
      </div>

      {/* KPI Detail Dialog */}
      <ExecutiveKpiDetailDialog
        open={!!kpiDetail}
        onOpenChange={(o) => !o && setKpiDetail(null)}
        type={kpiDetail?.type || "ligacoes"}
        label={kpiDetail?.label || ""}
        scopeUserIds={null}
        scopeProfileIds={null}
        dateRange={kpiDateRange}
      />
    </div>
  );
}
